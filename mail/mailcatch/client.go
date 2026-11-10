// mail/mailcatch/client.go

package mailcatch

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-message/mail"
)

// imapSource is the live mailSource, with the mailbox already selected.
type imapSource struct {
	c *imapclient.Client
}

// dial connects with cfg.DialTimeout, over TLS when cfg asks for it.
func dial(cfg Config) (*imapclient.Client, string, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	timeout := cfg.DialTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	opts := &imapclient.Options{Dialer: &net.Dialer{Timeout: timeout}}
	if cfg.UseTLS {
		c, err := imapclient.DialTLS(addr, opts)
		return c, addr, err
	}
	c, err := imapclient.DialInsecure(addr, opts)
	return c, addr, err
}

func dialIMAP(cfg Config) (*imapSource, error) {
	c, addr, err := dial(cfg)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}

	if err := c.Login(cfg.Username, cfg.Password).Wait(); err != nil {
		c.Close()
		return nil, fmt.Errorf("login: %w", err)
	}

	if _, err := c.Select(cfg.Mbox, nil).Wait(); err != nil {
		c.Close()
		return nil, fmt.Errorf("select %s: %w", cfg.Mbox, err)
	}

	return &imapSource{c: c}, nil
}

func (s *imapSource) snapshotUnseenUIDs() ([]mailUID, error) {
	uids, err := s.searchUnseenUIDs()
	if err != nil {
		return nil, fmt.Errorf("snapshot search: %w", err)
	}
	return uids, nil
}

func (s *imapSource) fetchUnseen(skip map[mailUID]struct{}) ([]fetchedMail, error) {
	if err := s.c.Noop().Wait(); err != nil {
		return nil, fmt.Errorf("noop: %w", err)
	}

	uids, err := s.searchUnseenUIDs()
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}

	var toFetch []imap.UID
	for _, uid := range uids {
		if _, ok := skip[uid]; !ok {
			toFetch = append(toFetch, imap.UID(uid))
		}
	}
	if len(toFetch) == 0 {
		return nil, nil
	}

	return s.fetchMails(toFetch)
}

func (s *imapSource) searchUnseenUIDs() ([]mailUID, error) {
	criteria := &imap.SearchCriteria{NotFlag: []imap.Flag{imap.FlagSeen}}
	data, err := s.c.UIDSearch(criteria, nil).Wait()
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}

	all := data.AllUIDs()
	uids := make([]mailUID, len(all))
	for i, u := range all {
		uids[i] = mailUID(u)
	}
	return uids, nil
}

func (s *imapSource) fetchMails(uids []imap.UID) ([]fetchedMail, error) {
	bodySection := &imap.FetchItemBodySection{Peek: true}
	fetchOptions := &imap.FetchOptions{
		Envelope:    true,
		UID:         true,
		BodySection: []*imap.FetchItemBodySection{bodySection},
	}

	fetchCmd := s.c.Fetch(imap.UIDSetNum(uids...), fetchOptions)

	var results []fetchedMail
	for {
		msg := fetchCmd.Next()
		if msg == nil {
			break
		}
		parsed, err := parseFetchedMessage(msg)
		if err != nil {
			// Stop an oversized or broken literal rather than draining an unbounded stream.
			s.c.Close()
			return results, errors.Join(err, fetchCmd.Close())
		}
		results = append(results, parsed)
	}

	if err := fetchCmd.Close(); err != nil {
		return results, fmt.Errorf("fetch: %w", err)
	}
	return results, nil
}

func (s *imapSource) close() error {
	return s.c.Close()
}

func parseFetchedMessage(msg *imapclient.FetchMessageData) (fetchedMail, error) {
	var fm fetchedMail
	var envelope *imap.Envelope
	var bodyBytes []byte

	for {
		item := msg.Next()
		if item == nil {
			break
		}
		switch d := item.(type) {
		case imapclient.FetchItemDataUID:
			fm.UID = mailUID(d.UID)
		case imapclient.FetchItemDataEnvelope:
			envelope = d.Envelope
		case imapclient.FetchItemDataBodySection:
			var err error
			bodyBytes, err = readBody(d.Literal)
			if err != nil {
				return fm, err
			}
		}
	}

	if envelope != nil {
		fm.To = extractAddresses(envelope.To)
	}
	var err error
	fm.Body, err = parseBody(bodyBytes)
	return fm, err
}

func extractAddresses(addrs []imap.Address) []string {
	result := make([]string, 0, len(addrs))
	for _, addr := range addrs {
		result = append(result, addr.Mailbox+"@"+addr.Host)
	}
	return result
}

const maxMessageBytes = 1 << 20

func readBody(r io.Reader) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, maxMessageBytes+1))
	if err != nil {
		return nil, fmt.Errorf("mailcatch: read message: %w", err)
	}
	if len(data) > maxMessageBytes {
		return nil, fmt.Errorf("mailcatch: message exceeds %d bytes", maxMessageBytes)
	}
	return data, nil
}

// parseBody prefers inline text/plain, then HTML, and accepts unstructured text.
func parseBody(bodyBytes []byte) (string, error) {
	if len(bodyBytes) > maxMessageBytes {
		return "", fmt.Errorf("mailcatch: message exceeds %d bytes", maxMessageBytes)
	}
	if len(bodyBytes) == 0 {
		return "", nil
	}
	mr, err := mail.CreateReader(bytes.NewReader(bodyBytes))
	if err != nil {
		first, _, _ := bytes.Cut(bodyBytes, []byte("\n"))
		field, _, colon := bytes.Cut(first, []byte(":"))
		header := colon && len(field) > 0 && !bytes.ContainsAny(field, " \t\r")
		if header || bytes.Contains(bodyBytes, []byte("\r\n\r\n")) || bytes.Contains(bodyBytes, []byte("\n\n")) {
			return "", fmt.Errorf("mailcatch: MIME header: %w", err)
		}
		return string(bodyBytes), nil
	}
	defer mr.Close()
	return extractTextBody(mr)
}

func extractTextBody(mr *mail.Reader) (string, error) {
	html := ""
	for {
		p, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return html, nil
		}
		if err != nil {
			return "", fmt.Errorf("mailcatch: MIME part: %w", err)
		}
		header, ok := p.Header.(*mail.InlineHeader)
		if !ok {
			continue
		}
		mediaType, _, err := header.ContentType()
		if err != nil {
			return "", fmt.Errorf("mailcatch: content type: %w", err)
		}
		if mediaType != "text/plain" && mediaType != "text/html" {
			continue
		}
		body, err := readBody(p.Body)
		if err != nil {
			return "", err
		}
		if mediaType == "text/plain" {
			return string(body), nil
		}
		if html == "" {
			html = string(body)
		}
	}
}
