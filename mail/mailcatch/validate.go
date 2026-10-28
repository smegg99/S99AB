// mail/mailcatch/validate.go

package mailcatch

import (
	"errors"
	"io"
	"net"
	"syscall"
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
	c, _, err := dial(cfg)
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
	for _, lost := range []error{io.EOF, io.ErrUnexpectedEOF, io.ErrClosedPipe, net.ErrClosed, syscall.ECONNRESET, syscall.EPIPE} {
		if errors.Is(err, lost) {
			return true
		}
	}
	return false
}
