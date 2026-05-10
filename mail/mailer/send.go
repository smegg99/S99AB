// mail/mailer/send.go

package mailer

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"time"

	mail "github.com/wneessen/go-mail"
)

// Client is a configured SMTP sender.
type Client struct {
	cfg  Config
	opts Options
}

// New refuses an empty host; an app with no relay uses Discard.
func New(cfg Config, opts Options) (*Client, error) {
	if cfg.Host == "" {
		return nil, ErrHost
	}
	if cfg.From == "" {
		return nil, ErrFrom
	}
	if cfg.Port == 0 {
		cfg.Port = 587
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 20 * time.Second
	}
	return &Client{cfg: cfg, opts: opts}, nil
}

func (c *Client) Send(ctx context.Context, m Message) error {
	if err := m.validate(); err != nil {
		return err
	}

	started := time.Now()
	err := c.send(ctx, m)
	if c.opts.Observe != nil {
		c.opts.Observe(Sent{To: m.To, Subject: m.Subject, Took: time.Since(started), Err: err})
	}
	return err
}

func (c *Client) send(ctx context.Context, m Message) error {
	msg, err := c.compose(m)
	if err != nil {
		return err
	}

	client, err := mail.NewClient(c.cfg.Host, c.dialOptions()...)
	if err != nil {
		return fmt.Errorf("mailer: client: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.Timeout)
	defer cancel()

	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("mailer: send: %w", err)
	}
	return nil
}

func (c *Client) compose(m Message) (*mail.Msg, error) {
	msg := mail.NewMsg()

	if err := msg.FromFormat(c.cfg.FromName, c.cfg.From); err != nil {
		return nil, fmt.Errorf("mailer: from: %w", err)
	}
	if err := msg.To(m.To...); err != nil {
		return nil, fmt.Errorf("mailer: to: %w", err)
	}
	msg.Subject(m.Subject)

	// Clients render the last part they support, so HTML goes after plain text.
	msg.SetBodyString(mail.TypeTextPlain, m.Text)
	if m.HTML != "" {
		msg.AddAlternativeString(mail.TypeTextHTML, m.HTML)
	}

	for _, in := range m.Inline {
		if err := msg.EmbedReader(in.Filename, bytes.NewReader(in.Data),
			mail.WithFileContentID("<"+in.CID+">"),
			mail.WithFileContentType(mail.ContentType(in.ContentType)),
		); err != nil {
			return nil, fmt.Errorf("mailer: embed %s: %w", in.Filename, err)
		}
	}

	for _, att := range m.Attachments {
		if err := msg.AttachReader(att.Filename, bytes.NewReader(att.Data),
			mail.WithFileContentType(mail.ContentType(att.ContentType)),
		); err != nil {
			return nil, fmt.Errorf("mailer: attach %s: %w", att.Filename, err)
		}
	}
	return msg, nil
}

func (c *Client) dialOptions() []mail.Option {
	opts := []mail.Option{mail.WithPort(c.cfg.Port), mail.WithTimeout(c.cfg.Timeout)}

	if c.cfg.DisableTLS {
		opts = append(opts, mail.WithTLSPolicy(mail.NoTLS))
	} else {
		conf := &tls.Config{ServerName: c.cfg.Host, MinVersion: tls.VersionTLS12}
		conf.InsecureSkipVerify = c.cfg.SkipVerify && c.cfg.Insecure
		opts = append(opts, mail.WithTLSConfig(conf))
	}

	if !c.cfg.DisableAuth && c.cfg.Username != "" {
		opts = append(opts,
			mail.WithSMTPAuth(mail.SMTPAuthPlain),
			mail.WithUsername(c.cfg.Username),
			mail.WithPassword(c.cfg.Password),
		)
	}
	return opts
}
