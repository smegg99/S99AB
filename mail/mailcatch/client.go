// mail/mailcatch/client.go

package mailcatch

import (
	"bytes"
	"fmt"
	"io"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-message/mail"
)

// imapSource is the live mailSource, with the mailbox already selected.
type imapSource struct {
	c *imapclient.Client
}

func dialIMAP(cfg Config) (*imapSource, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	var c *imapclient.Client
	var err error
	if cfg.UseTLS {
		c, err = imapclient.DialTLS(addr, nil)
	} else {
		c, err = imapclient.DialInsecure(addr, nil)
	}
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
		results = append(results, parseFetchedMessage(msg))
	}

	if err := fetchCmd.Close(); err != nil {
		return results, fmt.Errorf("fetch: %w", err)
	}
	return results, nil
}

func (s *imapSource) close() error {
	return s.c.Close()
}

func parseFetchedMessage(msg *imapclient.FetchMessageData) fetchedMail {
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
			bodyBytes, _ = io.ReadAll(d.Literal)
		}
	}

	if envelope != nil {
		fm.To = extractAddresses(envelope.To)
	}
	fm.Body = parseBody(bodyBytes)
	return fm
}

func extractAddresses(addrs []imap.Address) []string {
	result := make([]string, 0, len(addrs))
	for _, addr := range addrs {
		result = append(result, addr.Mailbox+"@"+addr.Host)
	}
	return result
}

// parseBody returns the text/plain part, or the raw bytes when they are not MIME.
func parseBody(bodyBytes []byte) string {
	if len(bodyBytes) == 0 {
		return ""
	}
	mr, err := mail.CreateReader(bytes.NewReader(bodyBytes))
	if err != nil {
		return string(bodyBytes)
	}
	return extractTextBody(mr)
}

// extractTextBody returns the first inline (non-attachment) part's content.
func extractTextBody(mr *mail.Reader) string {
	for {
		p, err := mr.NextPart()
		if err != nil {
			break
		}
		if _, ok := p.Header.(*mail.InlineHeader); ok {
			body, err := io.ReadAll(p.Body)
			if err == nil && len(body) > 0 {
				return string(body)
			}
		}
	}
	return ""
}
