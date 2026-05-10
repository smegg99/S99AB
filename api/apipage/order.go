// api/apipage/order.go

package apipage

import "strings"

// Order builds ORDER BY from sort using only strings from allowed, dropping
// unknown fields. fallback must not be empty, or pages have no stable order.
func Order(sort string, allowed []string, fallback string) string {
	clauses := make([]string, 0, len(allowed))
	seen := make(map[string]bool, len(allowed))

	for _, field := range strings.Split(sort, ",") {
		name, descending := strings.CutPrefix(strings.TrimSpace(field), "-")

		column, ok := match(name, allowed)
		if !ok || seen[column] {
			continue
		}
		seen[column] = true

		direction := " ASC"
		if descending {
			direction = " DESC"
		}
		clauses = append(clauses, column+direction)
	}

	if len(clauses) == 0 {
		return fallback
	}
	return strings.Join(clauses, ", ")
}

// match returns the whitelisted spelling of name. Comparison is case-sensitive.
func match(name string, allowed []string) (string, bool) {
	for _, column := range allowed {
		if column == name {
			return column, true
		}
	}
	return "", false
}
