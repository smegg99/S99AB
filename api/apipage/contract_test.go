// api/apipage/contract_test.go

package apipage_test

import (
	"os"
	"regexp"
	"testing"

	"github.com/smegg99/s99ab/v2/api/apipage"
)

// Every parameter named in the contract fragment must change what Parse returns.
func TestEveryContractParameterIsParsed(t *testing.T) {
	const fragment = "../../contracts/parameters/pagination.yaml"

	body, err := os.ReadFile(fragment)
	if err != nil {
		t.Fatalf("read %s: %v", fragment, err)
	}

	found := regexp.MustCompile(`(?m)^\s+name:\s*(\S+)$`).FindAllStringSubmatch(string(body), -1)
	if len(found) == 0 {
		t.Fatalf("no parameters found in %s; the fragment moved or changed shape", fragment)
	}

	// A parameter Parse ignores leaves the result equal to the empty query's.
	base := apipage.Parse(ctx(t, "/items"), apipage.Options{})

	for _, match := range found {
		name := match[1]

		got := apipage.Parse(ctx(t, "/items?"+name+"=7"), apipage.Options{})
		if got == base {
			t.Fatalf("%s declares %q, and Parse read nothing from it: %+v", fragment, name, got)
		}
	}
}
