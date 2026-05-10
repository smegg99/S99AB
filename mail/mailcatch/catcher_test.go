// mail/mailcatch/catcher_test.go

package mailcatch

import (
	"errors"
	"regexp"
	"sync"
	"testing"
	"time"
)

// fakeSource filters by skip the same way imapSource does.
type fakeSource struct {
	mu       sync.Mutex
	snapshot []mailUID
	pending  []fetchedMail
	closed   bool
}

func (f *fakeSource) snapshotUnseenUIDs() ([]mailUID, error) {
	return f.snapshot, nil
}

func (f *fakeSource) fetchUnseen(skip map[mailUID]struct{}) ([]fetchedMail, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []fetchedMail
	for _, m := range f.pending {
		if _, ok := skip[m.UID]; ok {
			continue
		}
		out = append(out, m)
	}
	f.pending = nil
	return out, nil
}

func (f *fakeSource) close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	return nil
}

func (f *fakeSource) queue(m fetchedMail) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pending = append(f.pending, m)
}

const testPollInterval = 10 * time.Millisecond

func TestExtractVerificationCodeDefaultRegexFindsSixDigits(t *testing.T) {
	got := extractVerificationCode("your code is 123456, expires soon", nil)
	if got != "123456" {
		t.Fatalf("got %q, want 123456", got)
	}
}

// a custom regex with no capture group yields its whole match.
func TestExtractVerificationCodeHonorsCustomRegex(t *testing.T) {
	re := regexp.MustCompile(`[A-Z]{2}\d{4}`)
	got := extractVerificationCode("token AB1234 confirms your login", re)
	if got != "AB1234" {
		t.Fatalf("got %q, want AB1234", got)
	}
}

func TestExtractVerificationCodeNoMatchIsEmpty(t *testing.T) {
	got := extractVerificationCode("thanks for signing up", nil)
	if got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

func TestWaitForCodeReceivesDispatchedCode(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatalf("newCatcher: %v", err)
	}
	defer c.Close()

	src.queue(fetchedMail{UID: 1, To: []string{"u@x.io"}, Body: "code 445566"})

	got, err := c.WaitForCode("u@x.io", 2*time.Second)
	if err != nil {
		t.Fatalf("WaitForCode: %v", err)
	}
	if got != "445566" {
		t.Fatalf("got %q, want 445566", got)
	}
}

// mail for a recipient with no waiter never reaches another waiter.
func TestUnwatchedRecipientCodeIsDropped(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatalf("newCatcher: %v", err)
	}
	defer c.Close()

	src.queue(fetchedMail{UID: 1, To: []string{"other@nobody.io"}, Body: "code 111222"})

	_, err = c.WaitForCode("u@x.io", 150*time.Millisecond)
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout", err)
	}
}

func TestWaitForCodeTimesOutWithNoMatchingMail(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatalf("newCatcher: %v", err)
	}
	defer c.Close()

	_, err = c.WaitForCode("nobody@x.io", 100*time.Millisecond)
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout", err)
	}
}

func TestCloseUnblocksPendingWaitForCode(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatalf("newCatcher: %v", err)
	}

	result := make(chan error, 1)
	go func() {
		_, err := c.WaitForCode("someone@x.io", 5*time.Second)
		result <- err
	}()

	time.Sleep(30 * time.Millisecond) // let WaitForCode register its waiter
	if err := c.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	select {
	case err := <-result:
		if !errors.Is(err, ErrClosed) {
			t.Fatalf("err = %v, want ErrClosed", err)
		}
	case <-time.After(time.Second):
		t.Fatal("WaitForCode did not unblock when Close was called")
	}
}

// mail already unseen before the Catcher started is never dispatched.
func TestSnapshotIgnoresPreExistingUIDs(t *testing.T) {
	src := &fakeSource{snapshot: []mailUID{7}}
	src.queue(fetchedMail{UID: 7, To: []string{"u@x.io"}, Body: "code 998877"})

	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatalf("newCatcher: %v", err)
	}
	defer c.Close()

	_, err = c.WaitForCode("u@x.io", 150*time.Millisecond)
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout (pre-existing UID should be ignored)", err)
	}
}
