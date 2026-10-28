// mail/mailcatch/config.go

package mailcatch

import (
	"regexp"
	"time"
)

// defaultCodeRegex matches a bare six-digit code, the shape most providers use.
var defaultCodeRegex = regexp.MustCompile(`\b(\d{6})\b`)

const defaultPollInterval = 5 * time.Second

// Config configures a Catcher and ValidateCredentials.
type Config struct {
	Host, Username, Password, Mbox string
	Port                           int
	UseTLS                         bool

	// CodeRegex's first capture group is the code. Nil means defaultCodeRegex.
	CodeRegex *regexp.Regexp
	// PollInterval zero means 5s.
	PollInterval time.Duration
	// DialTimeout bounds connecting to the server. Zero means 10s.
	DialTimeout time.Duration
}

func (c Config) pollInterval() time.Duration {
	if c.PollInterval > 0 {
		return c.PollInterval
	}
	return defaultPollInterval
}
