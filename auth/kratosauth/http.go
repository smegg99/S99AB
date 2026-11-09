// auth/kratosauth/http.go

package kratosauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const responseLimit = 1 << 20

func endpoint(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("kratosauth: expected an HTTP endpoint without credentials, query or fragment")
	}
	return strings.TrimRight(raw, "/"), nil
}

// Requests carry their own credentials; redirects and client jars must not add or forward others.
func clientFor(client *http.Client) *http.Client {
	copy := http.Client{}
	if client != nil {
		copy = *client
	}
	copy.Jar = nil
	copy.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &copy
}

func decodeResponse(ctx context.Context, resp *http.Response, into any) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, responseLimit+1))
	if err != nil {
		return callerGone(ctx, err)
	}
	if len(body) > responseLimit {
		return fmt.Errorf("%w: response too large", ErrUpstream)
	}
	if err := json.Unmarshal(body, into); err != nil {
		return fmt.Errorf("%w: invalid response: %v", ErrUpstream, err)
	}
	return nil
}
