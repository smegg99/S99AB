// mail/mailer/mailer.go

// Package mailer sends transactional mail over SMTP; it logs nothing, Observe sees every send.
package mailer

import (
	"context"
	"errors"
	"time"
)

var (
	ErrHost = errors.New("mailer: a host is required")
	ErrFrom = errors.New("mailer: a from address is required")
	ErrTo   = errors.New("mailer: at least one recipient is required")
)

// Config is the SMTP transport.
type Config struct {
	Host     string
	Port     int
	Username string
	Password string

	// From is the envelope sender; FromName is what a reader sees beside it.
	From     string
	FromName string

	// DisableTLS is for a loopback catcher only.
	DisableTLS bool
	// DisableAuth skips login; a real relay refuses it.
	DisableAuth bool
	// SkipVerify accepts any certificate, and only takes effect when Insecure is also set.
	SkipVerify bool
	Insecure   bool

	// Timeout covers dial, handshake and delivery together.
	Timeout time.Duration
}

type Attachment struct {
	Filename    string
	ContentType string
	Data        []byte
}

// Inline is referenced by cid: in the HTML and renders in clients that block remote images.
type Inline struct {
	// CID has no angle brackets; the template refers to `logo` as `cid:logo`.
	CID         string
	Filename    string
	ContentType string
	Data        []byte
}

// Message is one email. Leave Text empty and spam filters score it worse.
type Message struct {
	To      []string
	Subject string
	HTML    string
	Text    string

	Attachments []Attachment
	Inline      []Inline
}

func (m Message) validate() error {
	if len(m.To) == 0 {
		return ErrTo
	}
	return nil
}

// Sent is passed to Observe for every send, failed or not.
type Sent struct {
	To      []string
	Subject string
	Took    time.Duration
	// Err is nil on success. A discarded message reports Discarded instead.
	Err       error
	Discarded bool
}

type Options struct {
	Observe func(Sent)
}

type Sender interface {
	Send(ctx context.Context, m Message) error
}

// Discard delivers nothing; it is the explicit choice when no relay is configured.
func Discard(opts Options) Sender { return discard{observe: opts.Observe} }

type discard struct{ observe func(Sent) }

func (d discard) Send(_ context.Context, m Message) error {
	if d.observe != nil {
		d.observe(Sent{To: m.To, Subject: m.Subject, Discarded: true})
	}
	return m.validate()
}
