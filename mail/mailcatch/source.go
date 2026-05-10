// mail/mailcatch/source.go

package mailcatch

// mailUID is a plain uint32 so nothing outside client.go imports go-imap.
type mailUID = uint32

// fetchedMail carries no IMAP or MIME types.
type fetchedMail struct {
	UID  mailUID
	To   []string
	Body string
}

// mailSource is the polled backend; tests inject a fake.
type mailSource interface {
	// snapshotUnseenUIDs lists unseen UIDs at startup, so old mail is never taken for a fresh code.
	snapshotUnseenUIDs() ([]mailUID, error)
	// fetchUnseen returns unseen mail whose UID is not in skip.
	fetchUnseen(skip map[mailUID]struct{}) ([]fetchedMail, error)
	close() error
}
