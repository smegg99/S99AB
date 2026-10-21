// auth/kratosclient/kratosclient_test.go
package kratosclient_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/smegg99/s99ab/auth/kratosclient"
)

// kratos fakes a Kratos public endpoint mounted under a path, as behind a proxy.
type kratos struct {
	paths        []string
	queries      []string
	bearer       []string
	bodies       []map[string]string
	loginCode    int
	loginBody    string
	whoami       string
	settingsCode int
	settingsBody string
	deadToken    bool
}

const mount = "/kratos"

func (k *kratos) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	k.paths = append(k.paths, r.URL.Path)
	k.queries = append(k.queries, r.URL.RawQuery)
	k.bearer = append(k.bearer, r.Header.Get("Authorization"))
	var body map[string]string
	_ = json.NewDecoder(r.Body).Decode(&body)
	k.bodies = append(k.bodies, body)
	w.Header().Set("Content-Type", "application/json")

	switch r.URL.Path {
	case mount + "/self-service/login/api":
		if r.URL.Query().Get("refresh") == "true" {
			refresh := r.Header.Get("Authorization") != "" && !k.deadToken
			_, _ = w.Write([]byte(`{"id":"flow-1","refresh":` + map[bool]string{true: "true", false: "false"}[refresh] + `}`))
			return
		}
		_, _ = w.Write([]byte(`{"id":"flow-1","ui":{"action":"a","method":"POST","nodes":[
			{"type":"input","group":"password","attributes":{"name":"identifier","type":"text"},
			 "meta":{"label":{"id":1070004,"text":"ID"}}}]}}`))
	case mount + "/self-service/login":
		if k.loginCode != 0 {
			w.WriteHeader(k.loginCode)
		}
		_, _ = w.Write([]byte(k.loginBody))
	case mount + "/sessions/whoami":
		_, _ = w.Write([]byte(k.whoami))
	case mount + "/self-service/settings/api":
		_, _ = w.Write([]byte(`{"id":"settings-1"}`))
	case mount + "/self-service/settings":
		if k.settingsCode != 0 {
			w.WriteHeader(k.settingsCode)
			_, _ = w.Write([]byte(k.settingsBody))
			return
		}
		_, _ = w.Write([]byte(`{"state":"success"}`))
	case mount + "/self-service/logout/api":
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func serve(t *testing.T, node *kratos) (*kratosclient.Client, *kratos) {
	t.Helper()
	server := httptest.NewServer(node)
	t.Cleanup(server.Close)
	client, err := kratosclient.New(server.URL+mount, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	return client, node
}

const signedIn = `{"id":"sess-1","active":true,"expires_at":"2026-09-17T16:05:38Z","identity":{
	"id":"03b1a366","traits":{"username":"kowalski","email":"k@szkola.edu.pl","name":"Jan Kowalski"},
	"metadata_public":{"role":"admin","must_change_password":true}}}`

// BeginLogin returns Kratos's flow whole for the caller to render.
func TestBeginLoginReturnsTheFlowsOwnNodes(t *testing.T) {
	client, _ := serve(t, &kratos{})

	flow, err := client.BeginLogin(t.Context())
	if err != nil {
		t.Fatalf("begin login: %v", err)
	}
	if flow.ID != "flow-1" || len(flow.Nodes) != 1 {
		t.Fatalf("flow = %+v", flow)
	}
	node := flow.Nodes[0]
	if node.Attributes.Name != "identifier" || node.Meta.Label.ID != 1070004 {
		t.Errorf("node = %+v", node)
	}
}

// Neither login call sends a session token.
func TestSubmitLoginReturnsTheTokenAndClaimsNoSession(t *testing.T) {
	client, node := serve(t, &kratos{loginBody: `{"session_token":"ory_st_abc"}`})

	flow, err := client.BeginLogin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	token, again, err := client.SubmitLogin(t.Context(), flow.ID,
		map[string]any{"method": "password", "identifier": "k@szkola.edu.pl", "password": "secret"})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if token != "ory_st_abc" || again.ID != "" {
		t.Errorf("token = %q, again = %+v", token, again)
	}
	want := []string{mount + "/self-service/login/api", mount + "/self-service/login"}
	if len(node.paths) != 2 || node.paths[0] != want[0] || node.paths[1] != want[1] {
		t.Errorf("paths = %v, want %v", node.paths, want)
	}
	for _, header := range node.bearer {
		if header != "" {
			t.Errorf("sign-in sent %q, want no Authorization header", header)
		}
	}
}

// A refused login returns the flow again with Kratos's messages and no error.
func TestARefusedSubmissionComesBackAsTheFlow(t *testing.T) {
	client, _ := serve(t, &kratos{
		loginCode: http.StatusBadRequest,
		loginBody: `{"id":"flow-1","ui":{"messages":[{"id":4000006,"type":"error","text":"Nieprawidlowe dane logowania."}]}}`,
	})

	token, again, err := client.SubmitLogin(t.Context(), "flow-1", map[string]any{"method": "password"})
	if err != nil {
		t.Fatalf("a refusal must not be an error: %v", err)
	}
	if token != "" || len(again.Messages) != 1 {
		t.Fatalf("token = %q, again = %+v", token, again)
	}
	if again.Messages[0].ID != 4000006 {
		t.Errorf("message lost its id: %+v", again.Messages[0])
	}
}

// Roles come from metadata_public, which only the admin API writes, never from traits.
func TestWhoamiCarriesTheIdentityWhole(t *testing.T) {
	client, node := serve(t, &kratos{whoami: signedIn})

	session, err := client.Whoami(t.Context(), "ory_st_abc")
	if err != nil {
		t.Fatalf("whoami: %v", err)
	}
	var role string
	if err := session.Identity.Meta("role", &role); err != nil || role != "admin" {
		t.Errorf("role = %q (err %v)", role, err)
	}
	var flagged bool
	if err := session.Identity.Meta("must_change_password", &flagged); err != nil || !flagged {
		t.Errorf("must_change_password = %v (err %v)", flagged, err)
	}
	if session.Identity.Email() != "k@szkola.edu.pl" {
		t.Errorf("email = %q", session.Identity.Email())
	}
	if session.ExpiresAt.IsZero() || session.ID != "sess-1" {
		t.Errorf("session = %+v", session)
	}
	if node.bearer[0] != "Bearer ory_st_abc" {
		t.Errorf("authorization = %q", node.bearer[0])
	}
}

// An inactive session is ErrNoSession.
func TestAnInactiveSessionIsNoSession(t *testing.T) {
	client, _ := serve(t, &kratos{whoami: `{"active":false}`})

	if _, err := client.Whoami(t.Context(), "ory_st_old"); !errors.Is(err, kratosclient.ErrNoSession) {
		t.Errorf("err = %v, want ErrNoSession", err)
	}
}

// A refused token is ErrNoSession and carries Kratos's reason.
func TestARefusedTokenIsNoSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"reason":"session expired"}}`))
	}))
	t.Cleanup(server.Close)
	client, err := kratosclient.New(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Whoami(t.Context(), "ory_st_old")
	if !errors.Is(err, kratosclient.ErrNoSession) {
		t.Fatalf("err = %v, want ErrNoSession", err)
	}
	if err.Error() != "session expired" {
		t.Errorf("message = %q, want the server's own reason", err.Error())
	}
}

// A 5xx answer passes through instead of becoming a Rejection.
func TestAServerFailureIsNotARefusal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)
	client, err := kratosclient.New(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := client.Whoami(t.Context(), "ory_st_abc"); errors.Is(err, kratosclient.ErrNoSession) {
		t.Errorf("err = %v, want a transport failure, not a refusal", err)
	}
}

// ChangePassword sends the session token on both settings-flow calls.
func TestChangePasswordRunsTheSettingsFlowWithTheSession(t *testing.T) {
	client, node := serve(t, &kratos{})

	if err := client.ChangePassword(t.Context(), "ory_st_abc", "a-real-password"); err != nil {
		t.Fatalf("change password: %v", err)
	}
	want := []string{mount + "/self-service/settings/api", mount + "/self-service/settings"}
	if len(node.paths) != 2 || node.paths[0] != want[0] || node.paths[1] != want[1] {
		t.Errorf("paths = %v, want %v", node.paths, want)
	}
	for _, header := range node.bearer {
		if header != "Bearer ory_st_abc" {
			t.Errorf("authorization = %q, want the session on both calls", header)
		}
	}
}

// A settings flow that does not end in success is ErrPasswordRejected.
func TestASettingsFlowThatDidNotSucceedIsARefusal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/self-service/settings/api" {
			_, _ = w.Write([]byte(`{"id":"settings-1"}`))
			return
		}
		_, _ = w.Write([]byte(`{"state":"show_form"}`))
	}))
	t.Cleanup(server.Close)
	client, err := kratosclient.New(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}

	if err := client.ChangePassword(t.Context(), "ory_st_abc", "short"); !errors.Is(err, kratosclient.ErrPasswordRejected) {
		t.Errorf("err = %v, want ErrPasswordRejected", err)
	}
}

// session_refresh_required is ErrReauthRequired, distinct from ErrPasswordRejected.
func TestAChangeThatNeedsTheSessionProvedAgainSaysSo(t *testing.T) {
	client, _ := serve(t, &kratos{
		settingsCode: http.StatusForbidden,
		settingsBody: `{"error":{"id":"session_refresh_required","code":403,"reason":"The login session is too old."}}`,
	})

	err := client.ChangePassword(t.Context(), "ory_st_abc", "a-real-password")
	if !errors.Is(err, kratosclient.ErrReauthRequired) {
		t.Errorf("err = %v, want ErrReauthRequired", err)
	}
}

// A rejected password carries Kratos's message id for translation.
func TestARefusedPasswordCarriesKratossReason(t *testing.T) {
	client, _ := serve(t, &kratos{
		settingsCode: http.StatusBadRequest,
		settingsBody: `{"id":"settings-1","ui":{"nodes":[{"type":"input","attributes":{"name":"password"},
			"messages":[{"id":4000031,"text":"The password can not be used because it is too similar to the identifier.","type":"error"}]}]}}`,
	})

	err := client.ChangePassword(t.Context(), "ory_st_abc", "k@szkola")
	var rejection *kratosclient.Rejection
	if !errors.As(err, &rejection) || !errors.Is(err, kratosclient.ErrPasswordRejected) {
		t.Fatalf("err = %v, want a Rejection of ErrPasswordRejected", err)
	}
	if rejection.Message.ID != 4000031 {
		t.Errorf("message id = %d, want 4000031", rejection.Message.ID)
	}
}

// Refresh posts the identifier and password to a refresh-mode login flow for the same token.
func TestRefreshRunsARefreshLoginForTheSession(t *testing.T) {
	client, node := serve(t, &kratos{loginBody: `{"session":{"id":"sess-1"}}`})

	if err := client.Refresh(t.Context(), "ory_st_abc", "k@szkola.edu.pl", "the-old-one"); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if len(node.paths) != 2 || node.paths[0] != mount+"/self-service/login/api" || node.queries[0] != "refresh=true" {
		t.Errorf("first call = %v?%v, want the login flow with refresh=true", node.paths, node.queries)
	}
	for _, header := range node.bearer {
		if header != "Bearer ory_st_abc" {
			t.Errorf("authorization = %q, want the session on both calls", header)
		}
	}
	if got := node.bodies[1]; got["identifier"] != "k@szkola.edu.pl" || got["password"] != "the-old-one" || got["method"] != "password" {
		t.Errorf("submitted = %v", got)
	}
}

// A wrong current password is ErrCredentials.
func TestARefusedRefreshIsWrongCredentials(t *testing.T) {
	client, _ := serve(t, &kratos{
		loginCode: http.StatusBadRequest,
		loginBody: `{"id":"flow-1","ui":{"messages":[{"id":4000006,"text":"The provided credentials are invalid.","type":"error"}]}}`,
	})

	if err := client.Refresh(t.Context(), "ory_st_abc", "k@szkola.edu.pl", "wrong"); !errors.Is(err, kratosclient.ErrCredentials) {
		t.Errorf("err = %v, want ErrCredentials", err)
	}
}

// A rejected token gets an ordinary login flow back, which Refresh reports as ErrNoSession.
func TestRefreshWithADeadTokenIsNoSession(t *testing.T) {
	client, node := serve(t, &kratos{deadToken: true})

	if err := client.Refresh(t.Context(), "ory_st_dead", "k@szkola.edu.pl", "the-old-one"); !errors.Is(err, kratosclient.ErrNoSession) {
		t.Errorf("err = %v, want ErrNoSession", err)
	}
	if len(node.paths) != 1 {
		t.Errorf("paths = %v, want no submission after a flow that is not a refresh", node.paths)
	}
}

// Only message 4000006 maps to ErrCredentials; other refusals pass through.
func TestARefreshRefusedForAnotherReasonIsNotWrongCredentials(t *testing.T) {
	client, _ := serve(t, &kratos{
		loginCode: http.StatusTooManyRequests,
		loginBody: `{"error":{"code":429,"message":"slow down"}}`,
	})

	err := client.Refresh(t.Context(), "ory_st_abc", "k@szkola.edu.pl", "the-old-one")
	if err == nil || errors.Is(err, kratosclient.ErrCredentials) {
		t.Errorf("err = %v, want an error that is not ErrCredentials", err)
	}
}

// A refusal without a flow, such as from a proxy, exposes its status and body through Answered.
func TestASubmissionAnsweredWithoutAFlowCarriesItsAnswer(t *testing.T) {
	body := `{"code":"rate_limited","message":"auth.signInBlocked","details":{"Seconds":"900"}}`
	client, _ := serve(t, &kratos{loginCode: http.StatusTooManyRequests, loginBody: body})

	_, _, err := client.SubmitLogin(t.Context(), "flow-1", map[string]any{"method": "password"})
	code, answered, ok := kratosclient.Answered(err)
	if !ok || code != http.StatusTooManyRequests || string(answered) != body {
		t.Errorf("Answered = %d %q %v, from %v", code, answered, ok, err)
	}
}

// A transport error carries no answer.
func TestAnErrorThatIsNotAnAnswerCarriesNone(t *testing.T) {
	for _, err := range []error{nil, errors.New("dial tcp: refused")} {
		if code, body, ok := kratosclient.Answered(err); ok || code != 0 || body != nil {
			t.Errorf("Answered(%v) = %d %q %v", err, code, body, ok)
		}
	}
}

// New rejects an address without a scheme or a host.
func TestAnAddressThatIsNotAnEndpointIsRefused(t *testing.T) {
	for _, address := range []string{"", "ftp://kratos.example.com", "not a url"} {
		if _, err := kratosclient.New(address, nil); err == nil {
			t.Errorf("%q was accepted as a Kratos URL", address)
		}
	}
}

// SignOut sends the token in the body and no Authorization header.
func TestSignOutSendsTheTokenInTheBody(t *testing.T) {
	var body map[string]string
	var header string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)
	client, err := kratosclient.New(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}

	if err := client.SignOut(t.Context(), "ory_st_abc"); err != nil {
		t.Fatalf("sign out: %v", err)
	}
	if body["session_token"] != "ory_st_abc" || header != "" {
		t.Errorf("body = %v, authorization = %q", body, header)
	}
}
