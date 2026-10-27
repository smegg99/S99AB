// data/outbox/stamp_internal_test.go

package outbox

import (
	"testing"
	"time"
)

// Stamps are compared as TEXT in SQL, so their order must be the times' order.
func TestStampsSortAsTimes(t *testing.T) {
	base := time.Date(2026, 10, 28, 10, 0, 0, 0, time.UTC)
	times := []time.Time{
		base,
		base.Add(500 * time.Millisecond),
		base.Add(time.Second),
		base.Add(2 * time.Second).In(time.FixedZone("CEST", 2*3600)),
	}
	for i := 1; i < len(times); i++ {
		if a, b := stamp(times[i-1]), stamp(times[i]); a >= b {
			t.Errorf("stamp %q is not before %q", a, b)
		}
	}
}
