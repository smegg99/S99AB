// mail/mailcatch/waiters_test.go

package mailcatch

import (
	"fmt"
	"net"
	"slices"
	"sync"
	"testing"
	"time"
)

// waitAll starts n waiters on email once they are registered and returns their codes.
func waitAll(t *testing.T, c *Catcher, email string, n int) func() []string {
	t.Helper()
	var wg sync.WaitGroup
	codes := make([]string, n)
	for i := range n {
		wg.Go(func() { codes[i], _ = c.WaitForCode(email, 3*time.Second) })
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		got := len(c.waiters[email])
		c.mu.Unlock()
		if got == n {
			break
		}
		time.Sleep(time.Millisecond)
	}
	return func() []string { wg.Wait(); return codes }
}

func TestTwoWaitersForOneAddressEachGetACode(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	wait := waitAll(t, c, "u@x.io", 2)
	src.queue(fetchedMail{UID: 1, To: []string{"u@x.io"}, Body: "code 111111"})
	src.queue(fetchedMail{UID: 2, To: []string{"u@x.io"}, Body: "code 222222"})

	codes := wait()
	slices.Sort(codes)
	if !slices.Equal(codes, []string{"111111", "222222"}) {
		t.Fatalf("codes = %q, want one each", codes)
	}
}

// More codes than one waiter takes, in one poll, must not block dispatch, which holds mu.
func TestASecondCodeForOneWaiterDoesNotDeadlock(t *testing.T) {
	src := &fakeSource{}
	c, err := newCatcher(Config{PollInterval: testPollInterval}, src)
	if err != nil {
		t.Fatal(err)
	}
	wait := waitAll(t, c, "u@x.io", 1)
	src.queue(fetchedMail{UID: 1, To: []string{"u@x.io"}, Body: "code 111111"})
	src.queue(fetchedMail{UID: 2, To: []string{"u@x.io"}, Body: "code 222222"})
	src.queue(fetchedMail{UID: 3, To: []string{"u@x.io"}, Body: "code 333333"})
	wait()

	closed := make(chan error, 1)
	go func() { closed <- c.Close() }()
	select {
	case <-closed:
	case <-time.After(2 * time.Second):
		t.Fatal("Close blocked: dispatch is stuck holding mu")
	}
}

func TestCloseTwiceIsSafe(t *testing.T) {
	c, err := newCatcher(Config{PollInterval: testPollInterval}, &fakeSource{})
	if err != nil {
		t.Fatal(err)
	}
	_ = c.Close()
	_ = c.Close()
}

func TestIsConnectionLostReadsWrappedErrors(t *testing.T) {
	if !isConnectionLost(fmt.Errorf("login: %w", net.ErrClosed)) {
		t.Fatal("a closed connection was not seen as lost")
	}
}

// go-imap formats read errors with %v, so the chain is gone and only the text says what happened.
func TestIsConnectionLostReadsGoIMAPsFlattenedErrors(t *testing.T) {
	err := fmt.Errorf("in response: cannot read tag: %v", "read tcp 10.0.0.2:51000->10.0.0.1:143: read: connection reset by peer")
	if !isConnectionLost(err) {
		t.Fatal("a reset during login was not seen as lost")
	}
}
