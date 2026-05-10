// api/apipage/order_test.go

package apipage_test

import (
	"strings"
	"testing"

	"github.com/smegg99/s99ab/api/apipage"
)

var columns = []string{"name", "created_at", "size"}

// The `-` prefix is the contract's descending marker.
func TestOrderReadsTheContractSyntax(t *testing.T) {
	for _, tc := range []struct{ sort, want string }{
		{"name", "name ASC"},
		{"-created_at", "created_at DESC"},
		{"name,-created_at", "name ASC, created_at DESC"},
	} {
		if got := apipage.Order(tc.sort, columns, "id ASC"); got != tc.want {
			t.Fatalf("%q -> %q, want %q", tc.sort, got, tc.want)
		}
	}
}

func TestNothingFromTheRequestReachesTheClause(t *testing.T) {
	attacks := []string{
		"name; DROP TABLE items",
		"name) UNION SELECT password FROM identities --",
		"(SELECT 1)",
		"name ASC, size DESC",
		"NAME",
	}

	for _, attack := range attacks {
		got := apipage.Order(attack, columns, "id ASC")

		for _, word := range []string{"DROP", "UNION", "SELECT", "--", ";", "(", ")"} {
			if strings.Contains(got, word) {
				t.Fatalf("%q -> %q; %q survived into the clause", attack, got, word)
			}
		}
	}
}

func TestUnknownFieldsAreDroppedNotRejected(t *testing.T) {
	if got := apipage.Order("gone,name", columns, "id ASC"); got != "name ASC" {
		t.Fatalf("got %q, want the known field alone", got)
	}
}

func TestNothingSurvivableFallsBack(t *testing.T) {
	for _, sort := range []string{"", "gone", "-gone,alsogone", ",,,", "-"} {
		if got := apipage.Order(sort, columns, "id ASC"); got != "id ASC" {
			t.Fatalf("%q -> %q, want the fallback", sort, got)
		}
	}
}

func TestARepeatedFieldIsOrderedOnce(t *testing.T) {
	if got := apipage.Order("name,-name", columns, "id ASC"); got != "name ASC" {
		t.Fatalf("got %q, want the first direction only", got)
	}
}
