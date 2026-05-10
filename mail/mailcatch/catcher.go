// mail/mailcatch/catcher.go

// Package mailcatch polls an IMAP mailbox for verification codes.
package mailcatch

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

var (
	ErrTimeout = errors.New("mailcatch: timed out waiting for a code")
	ErrClosed  = errors.New("mailcatch: closed while waiting for a code")
)

// Catcher dispatches verification codes to the caller waiting on each recipient.
type Catcher struct {
	src          mailSource
	codeRegex    *regexp.Regexp
	pollInterval time.Duration

	// mu guards waiters and processed.
	mu        sync.Mutex
	waiters   map[string]chan string // recipient (lowercase) -> channel to send its code to
	processed map[mailUID]struct{}

	stop chan struct{}
	done chan struct{}
}

// New dials the mailbox, marks already-unseen mail as processed and starts polling.
func New(cfg Config) (*Catcher, error) {
	src, err := dialIMAP(cfg)
	if err != nil {
		return nil, fmt.Errorf("mailcatch: %w", err)
	}
	return newCatcher(cfg, src)
}

func newCatcher(cfg Config, src mailSource) (*Catcher, error) {
	existing, err := src.snapshotUnseenUIDs()
	if err != nil {
		src.close()
		return nil, fmt.Errorf("mailcatch: snapshot: %w", err)
	}

	processed := make(map[mailUID]struct{}, len(existing))
	for _, uid := range existing {
		processed[uid] = struct{}{}
	}

	c := &Catcher{
		src:          src,
		codeRegex:    cfg.CodeRegex,
		pollInterval: cfg.pollInterval(),
		waiters:      make(map[string]chan string),
		processed:    processed,
		stop:         make(chan struct{}),
		done:         make(chan struct{}),
	}

	go c.pollLoop()
	return c, nil
}

// WaitForCode blocks until a verification code arrives for email, Close runs,
// or timeout elapses.
func (c *Catcher) WaitForCode(email string, timeout time.Duration) (string, error) {
	key := strings.ToLower(email)
	ch := make(chan string, 1)

	c.mu.Lock()
	c.waiters[key] = ch
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.waiters, key)
		c.mu.Unlock()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	select {
	case code := <-ch:
		return code, nil
	case <-ctx.Done():
		return "", fmt.Errorf("%w: %s", ErrTimeout, email)
	case <-c.stop:
		return "", fmt.Errorf("%w: %s", ErrClosed, email)
	}
}

// Close stops polling and unblocks pending WaitForCode calls with ErrClosed.
func (c *Catcher) Close() error {
	close(c.stop)
	<-c.done
	return c.src.close()
}

func (c *Catcher) pollLoop() {
	defer close(c.done)

	ticker := time.NewTicker(c.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.stop:
			return
		case <-ticker.C:
			c.poll()
		}
	}
}

// poll skips the fetch when no caller is waiting.
func (c *Catcher) poll() {
	c.mu.Lock()
	if len(c.waiters) == 0 {
		c.mu.Unlock()
		return
	}
	// Copied so fetchUnseen can be called without holding mu.
	skip := make(map[mailUID]struct{}, len(c.processed))
	for uid := range c.processed {
		skip[uid] = struct{}{}
	}
	c.mu.Unlock()

	mails, err := c.src.fetchUnseen(skip)
	if err != nil {
		return
	}
	for _, m := range mails {
		c.dispatch(m)
	}
}

// dispatch leaves mail with no waiter unprocessed, so a later waiter can still match it.
func (c *Catcher) dispatch(m fetchedMail) {
	code := extractVerificationCode(m.Body, c.codeRegex)
	if code == "" {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	for _, to := range m.To {
		key := strings.ToLower(to)
		if ch, ok := c.waiters[key]; ok {
			ch <- code
			c.processed[m.UID] = struct{}{}
			return
		}
	}
}

// extractVerificationCode returns the first capture group, or the whole match when re has none.
func extractVerificationCode(body string, re *regexp.Regexp) string {
	if re == nil {
		re = defaultCodeRegex
	}
	match := re.FindStringSubmatch(body)
	switch {
	case len(match) > 1:
		return match[1]
	case len(match) == 1:
		return match[0]
	default:
		return ""
	}
}
