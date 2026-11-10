// auth/kratosauth/integration_test.go

package kratosauth_test

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/smegg99/s99ab/auth/kratosauth"
)

func kratosJSON(t *testing.T, method, endpoint string, body any, status int, result any) {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(t.Context(), method, endpoint, bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != status {
		t.Fatalf("Kratos %s: HTTP %d, want %d", method, resp.StatusCode, status)
	}
	if result != nil {
		if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(result); err != nil {
			t.Fatal(err)
		}
	}
}

func TestKratosSessionAndAdmin(t *testing.T) {
	public, adminURL := os.Getenv("S99AB_TEST_KRATOS_PUBLIC_URL"), os.Getenv("S99AB_TEST_KRATOS_ADMIN_URL")
	if public == "" || adminURL == "" {
		if os.Getenv("S99AB_REQUIRE_INTEGRATION") == "1" {
			t.Fatal("Kratos test endpoints are required")
		}
		t.Skip("run just test-services for Kratos coverage")
	}
	email, password := rand.Text()+"@example.test", rand.Text()+"-7!"
	var account struct{ ID string }
	kratosJSON(t, "POST", adminURL+"/admin/identities", map[string]any{
		"schema_id": "default", "traits": map[string]string{"email": email},
		"credentials": map[string]any{"password": map[string]any{"config": map[string]string{"password": password}}},
	}, http.StatusCreated, &account)
	var flow struct{ ID string }
	kratosJSON(t, "GET", public+"/self-service/login/api", nil, http.StatusOK, &flow)
	var login struct {
		Token string `json:"session_token"`
	}
	kratosJSON(t, "POST", public+"/self-service/login?flow="+flow.ID,
		map[string]string{"method": "password", "identifier": email, "password": password}, http.StatusOK, &login)
	client, err := kratosauth.New(kratosauth.Options{PublicURL: public})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Session-Token", login.Token)
	identity, err := client.Whoami(t.Context(), req)
	if err != nil || identity.ID != account.ID || identity.Email() != email {
		t.Fatalf("whoami did not return the created identity: %v", err)
	}
	admin, err := kratosauth.NewAdmin(adminURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := admin.FindByEmail(t.Context(), email)
	if err != nil || resolved.ID != account.ID {
		t.Fatalf("admin lookup did not return the created identity: %v", err)
	}
}
