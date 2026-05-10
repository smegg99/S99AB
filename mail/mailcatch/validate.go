// mail/mailcatch/validate.go

package mailcatch

import (
	"fmt"
	"io"
	"strings"

	"github.com/emersion/go-imap/v2/imapclient"
)

// ValidationError carries only a code for the frontend to localize.
type ValidationError struct {
	Code string `json:"code"`
}

func (e *ValidationError) Error() string {
	return e.Code
}

// ValidateCredentials returns a *ValidationError naming the step that failed.
func ValidateCredentials(cfg Config) error {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	var c *imapclient.Client
	var err error
	if cfg.UseTLS {
		c, err = imapclient.DialTLS(addr, nil)
	} else {
		c, err = imapclient.DialInsecure(addr, nil)
	}
	if err != nil {
		if !cfg.UseTLS {
			return &ValidationError{Code: "connection_failed_try_tls"}
		}
		return &ValidationError{Code: "connection_failed"}
	}
	defer c.Close()

	if err := c.Login(cfg.Username, cfg.Password).Wait(); err != nil {
		// A dropped plaintext connection during login usually means the server requires TLS.
		if !cfg.UseTLS && isConnectionLost(err) {
			return &ValidationError{Code: "login_failed_try_tls"}
		}
		return &ValidationError{Code: "login_failed"}
	}

	if _, err := c.Select(cfg.Mbox, nil).Wait(); err != nil {
		return &ValidationError{Code: "mailbox_not_found"}
	}

	return nil
}

func isConnectionLost(err error) bool {
	if err == io.EOF || err == io.ErrUnexpectedEOF {
		return true
	}
	s := err.Error()
	return strings.Contains(s, "EOF") || strings.Contains(s, "connection reset") || strings.Contains(s, "broken pipe")
}
