// work/daemon/socket.go
package daemon

// afUnixBound stays under sun_path (108 bytes on Linux, 104 on macOS/BSD).
const afUnixBound = 100
