// auth/kratosclient/client_internal_test.go

package kratosclient

import "testing"

func TestNewWithoutAClientHasATimeout(t *testing.T) {
	c, err := New("http://127.0.0.1:4433", nil)
	if err != nil {
		t.Fatal(err)
	}
	if c.httpClient.Timeout <= 0 {
		t.Fatal("the default client has no timeout")
	}
}
