// net/netprobe/ping.go

// Package netprobe reports host reachability by unprivileged ICMP echo, then TCP connect.
package netprobe

import (
	"context"
	"net"
	"os"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

// DefaultTCPPorts are probed when ICMP is off or fails.
var DefaultTCPPorts = []string{"80", "443", "7"}

type Options struct {
	// ICMP tries an unprivileged echo first; it needs net.ipv4.ping_group_range on Linux.
	ICMP bool
	// Timeout bounds each attempt. Zero means 3s.
	Timeout time.Duration
	// TCPPorts is the connect-fallback set; nil means DefaultTCPPorts.
	TCPPorts []string
	// Payload is the ICMP echo body; empty means "s99ab-ping".
	Payload string
}

type Result struct {
	Alive   bool
	Latency time.Duration
}

// Ping reports whether ip is reachable; it errors only on a malformed address.
func Ping(ctx context.Context, ip string, opts Options) (Result, error) {
	if net.ParseIP(ip) == nil {
		return Result{}, &net.AddrError{Err: "invalid IP", Addr: ip}
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 3 * time.Second
	}

	if opts.ICMP {
		if r, ok := icmpEcho(ctx, ip, timeout, opts.Payload); ok {
			return r, nil
		}
	}
	return tcpConnect(ctx, ip, timeout, opts.TCPPorts), nil
}

// icmpEcho returns ok=false when ICMP is unavailable or the host did not answer.
func icmpEcho(ctx context.Context, ip string, timeout time.Duration, payload string) (Result, bool) {
	conn, err := icmp.ListenPacket("udp4", "")
	if err != nil {
		return Result{}, false
	}
	defer conn.Close()

	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-done:
		}
	}()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	if payload == "" {
		payload = "s99ab-ping"
	}
	msg := &icmp.Message{
		Type: ipv4.ICMPTypeEcho, Code: 0,
		Body: &icmp.Echo{ID: os.Getpid() & 0xffff, Seq: 1, Data: []byte(payload)},
	}
	b, err := msg.Marshal(nil)
	if err != nil {
		return Result{}, false
	}

	start := time.Now()
	if _, err := conn.WriteTo(b, &net.UDPAddr{IP: net.ParseIP(ip)}); err != nil {
		return Result{}, false
	}

	reply := make([]byte, 1500)
	n, _, err := conn.ReadFrom(reply)
	latency := time.Since(start)
	if err != nil {
		return Result{}, false
	}
	rm, err := icmp.ParseMessage(1, reply[:n]) // protocol 1 = ICMP
	if err != nil || rm.Type != ipv4.ICMPTypeEchoReply {
		return Result{}, false
	}
	return Result{Alive: true, Latency: latency}, true
}

func tcpConnect(ctx context.Context, ip string, timeout time.Duration, ports []string) Result {
	if len(ports) == 0 {
		ports = DefaultTCPPorts
	}
	dialer := net.Dialer{Timeout: timeout}
	for _, port := range ports {
		if ctx.Err() != nil {
			return Result{}
		}
		start := time.Now()
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip, port))
		if err == nil {
			_ = conn.Close()
			return Result{Alive: true, Latency: time.Since(start)}
		}
	}
	return Result{}
}
