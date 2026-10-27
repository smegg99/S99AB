// auth/kratosauth/admin_internal_test.go

package kratosauth

import "testing"

func TestNewAdminWithoutAClientHasATimeout(t *testing.T) {
	admin, err := NewAdmin("http://127.0.0.1:4434", nil)
	if err != nil {
		t.Fatal(err)
	}
	if admin.client.Timeout <= 0 {
		t.Fatal("the default admin client has no timeout")
	}
}
