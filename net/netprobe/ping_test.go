// net/netprobe/ping_test.go

package netprobe_test

import (
	"context"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/smegg99/s99ab/net/netprobe"
)

func TestPingTCPConnectsToOpenPort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	_, portStr, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatalf("split host port: %v", err)
	}
	if _, err := strconv.Atoi(portStr); err != nil {
		t.Fatalf("port %q is not numeric: %v", portStr, err)
	}

	result, err := netprobe.Ping(context.Background(), "127.0.0.1", netprobe.Options{
		ICMP:     false,
		TCPPorts: []string{portStr},
	})
	if err != nil {
		t.Fatalf("ping: %v", err)
	}
	if !result.Alive {
		t.Fatal("Alive = false, want true: a listener is open on that port")
	}
	if result.Latency <= 0 {
		t.Fatalf("Latency = %v, want > 0", result.Latency)
	}
}

func TestPingDeadHostNotError(t *testing.T) {
	result, err := netprobe.Ping(context.Background(), "127.0.0.1", netprobe.Options{
		ICMP:     false,
		TCPPorts: []string{"1"},
		Timeout:  200 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("ping: %v, want nil: a dead host is not an error", err)
	}
	if result.Alive {
		t.Fatal("Alive = true, want false: nothing is listening on port 1")
	}
}

func TestPingInvalidIP(t *testing.T) {
	_, err := netprobe.Ping(context.Background(), "not-an-ip", netprobe.Options{})
	if err == nil {
		t.Fatal("err = nil, want non-nil for a malformed address")
	}
}
