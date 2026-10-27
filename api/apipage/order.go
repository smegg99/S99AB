// api/apipage/order.go

package apipage

import "strings"

// Order builds ORDER BY from sort using only strings from allowed, dropping
// unknown fields, then fallback's terms for columns sort did not name. fallback
// must end in a unique column, or pages have no stable order.
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

	for _, term := range strings.Split(fallback, ",") {
		term = strings.TrimSpace(term)
		column, _, _ := strings.Cut(term, " ")
		if term != "" && !seen[column] {
			clauses = append(clauses, term)
		}
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
