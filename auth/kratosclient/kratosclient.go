// auth/kratosclient/kratosclient.go

// Package kratosclient drives Ory Kratos's native API flow with a bearer session token.
package kratosclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/smegg99/s99ab/v2/auth/kratosauth"
)

// maxBody bounds a Kratos answer.
const maxBody = 1 << 20

// messageInvalidCredentials is Kratos's message id for a wrong identifier or password.
const messageInvalidCredentials = 4000006

var (
	// ErrCredentials is a sign-in Kratos refused.
	ErrCredentials = errors.New("kratosclient: the identifier or password is wrong")
	// ErrNoSession is a token Kratos rejects, expired or signed out.
	ErrNoSession = errors.New("kratosclient: no active session")
	// ErrPasswordRejected is a new password Kratos would not take.
	ErrPasswordRejected = errors.New("kratosclient: the password was refused")
	// ErrReauthRequired is a settings change that needs Refresh first: the
	// session is older than the deployment's privileged_session_max_age.
	ErrReauthRequired = errors.New("kratosclient: the session has to be signed in again first")
)

// Rejection carries Kratos's message for a refused submission.
type Rejection struct {
	Err error
	// Message carries Kratos's stable id for translation and its text as the fallback.
	Message Text
}

func (r *Rejection) Error() string {
	if r.Message.Text == "" {
		return r.Err.Error()
	}
	return r.Message.Text
}

func (r *Rejection) Unwrap() error { return r.Err }

// Session is who a token belongs to, and how long it lasts.
type Session struct {
	ID        string              `json:"id"`
	ExpiresAt time.Time           `json:"expiresAt"`
	Identity  kratosauth.Identity `json:"identity"`
}

// Client speaks the native flow against one Kratos public endpoint or its application proxy path.
type Client struct {
	httpClient *http.Client
	base       string
}

// New builds a client for a Kratos public URL. A nil http.Client gets one with a 10 s timeout.
func New(publicURL string, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(publicURL)
	if err != nil {
		return nil, err
	}
	if parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, fmt.Errorf("kratosclient: expected an HTTP URL, got %q", publicURL)
	}
	parsed.RawQuery, parsed.Fragment = "", ""
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{httpClient: httpClient, base: parsed.String()}, nil
}

// Whoami reports the session a token belongs to.
func (c *Client) Whoami(ctx context.Context, token string) (Session, error) {
	var answer struct {
		ID        string    `json:"id"`
		Active    bool      `json:"active"`
		ExpiresAt time.Time `json:"expires_at"`
		Identity  struct {
			ID             string          `json:"id"`
			Traits         json.RawMessage `json:"traits"`
			MetadataPublic json.RawMessage `json:"metadata_public"`
		} `json:"identity"`
	}
	if err := c.call(ctx, http.MethodGet, "/sessions/whoami", token, nil, &answer); err != nil {
		return Session{}, asRejection(err, ErrNoSession)
	}
	// Kratos answers 200 for an ended session, so the active flag decides.
	if !answer.Active {
		return Session{}, ErrNoSession
	}
	return Session{
		ID:        answer.ID,
		ExpiresAt: answer.ExpiresAt,
		Identity: kratosauth.Identity{
			ID:             answer.Identity.ID,
			Traits:         answer.Identity.Traits,
			MetadataPublic: answer.Identity.MetadataPublic,
			SessionID:      answer.ID,
		},
	}, nil
}

// ChangePassword replaces the password through the settings flow; the token keeps working.
func (c *Client) ChangePassword(ctx context.Context, token, password string) error {
	var flow struct {
		ID string `json:"id"`
	}
	if err := c.call(ctx, http.MethodGet, "/self-service/settings/api", token, nil, &flow); err != nil {
		return asRejection(err, ErrNoSession)
	}
	var answer struct {
		State string `json:"state"`
	}
	body := map[string]string{"method": "password", "password": password}
	path := "/self-service/settings?flow=" + url.QueryEscape(flow.ID)
	if err := c.call(ctx, http.MethodPost, path, token, body, &answer); err != nil {
		var answered *status
		if errors.As(err, &answered) && answered.errorID() == "session_refresh_required" {
			return ErrReauthRequired
		}
		return asRejection(err, ErrPasswordRejected)
	}
	if answer.State != "success" {
		return fmt.Errorf("%w: the settings flow ended as %q", ErrPasswordRejected, answer.State)
	}
	return nil
}

// Refresh re-authenticates the token's session; a non-refresh flow is ErrNoSession, and only message 4000006 is ErrCredentials.
func (c *Client) Refresh(ctx context.Context, token, identifier, password string) error {
	var flow struct {
		ID      string `json:"id"`
		Refresh bool   `json:"refresh"`
	}
	if err := c.call(ctx, http.MethodGet, "/self-service/login/api?refresh=true", token, nil, &flow); err != nil {
		return asRejection(err, ErrNoSession)
	}
	if !flow.Refresh {
		return ErrNoSession
	}
	body := map[string]string{"method": "password", "identifier": identifier, "password": password}
	path := "/self-service/login?flow=" + url.QueryEscape(flow.ID)
	if err := c.call(ctx, http.MethodPost, path, token, body, nil); err != nil {
		var answered *status
		if errors.As(err, &answered) && answered.message().ID == messageInvalidCredentials {
			return &Rejection{Err: ErrCredentials, Message: answered.message()}
		}
		return err
	}
	return nil
}

// SignOut asks Kratos to end the session. Callers drop the token whatever the answer.
func (c *Client) SignOut(ctx context.Context, token string) error {
	return c.call(ctx, http.MethodDelete, "/self-service/logout/api", "",
		map[string]string{"session_token": token}, nil)
}

// call runs one request and decodes the answer, if the caller wants one.
func (c *Client) call(ctx context.Context, method, path, token string, body, into any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.base+path, reader)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, maxBody))
	if err != nil {
		return err
	}
	if response.StatusCode >= 400 {
		return &status{code: response.StatusCode, body: payload}
	}
	if into == nil {
		return nil
	}
	return json.Unmarshal(payload, into)
}

// status is an error answer from Kratos, kept whole for the caller to interpret.
type status struct {
	code int
	body []byte
}

func (s *status) Error() string { return fmt.Sprintf("kratosclient: kratos answered %d", s.code) }

// message returns the first error in ui.messages, then ui.nodes[].messages, then the error object.
func (s *status) message() Text {
	var flow struct {
		UI struct {
			Messages []Text `json:"messages"`
			Nodes    []struct {
				Messages []Text `json:"messages"`
			} `json:"nodes"`
		} `json:"ui"`
		Error struct {
			Reason  string `json:"reason"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(s.body, &flow); err != nil {
		return Text{}
	}
	for _, message := range flow.UI.Messages {
		if message.Type == "error" && message.Text != "" {
			return message
		}
	}
	for _, node := range flow.UI.Nodes {
		for _, message := range node.Messages {
			if message.Type == "error" && message.Text != "" {
				return message
			}
		}
	}
	if flow.Error.Reason != "" {
		return Text{Text: flow.Error.Reason, Type: "error"}
	}
	if flow.Error.Message != "" {
		return Text{Text: flow.Error.Message, Type: "error"}
	}
	return Text{}
}

// errorID is a Kratos error's machine id, such as session_refresh_required, or "".
func (s *status) errorID() string {
	var answer struct {
		Error struct {
			ID string `json:"id"`
		} `json:"error"`
	}
	if err := json.Unmarshal(s.body, &answer); err != nil {
		return ""
	}
	return answer.Error.ID
}

// Answered returns the status and body an error from this client carries, such as a proxy's refusal.
func Answered(err error) (code int, body []byte, ok bool) {
	var answered *status
	if !errors.As(err, &answered) {
		return 0, nil, false
	}
	return answered.code, answered.body, true
}

// asStatus reports whether an error is a Kratos answer, and which one.
func asStatus(err error, into **status) (int, bool) {
	if !errors.As(err, into) {
		return 0, false
	}
	return (*into).code, true
}

// asRejection wraps a 4xx answer as a Rejection of kind; transport failures and 5xx pass through.
func asRejection(err error, kind error) error {
	var answered *status
	if !errors.As(err, &answered) {
		return err
	}
	if answered.code >= 500 {
		return err
	}
	return &Rejection{Err: kind, Message: answered.message()}
}
