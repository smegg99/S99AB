// auth/keto/keto.go

// Package keto checks and writes per-object permissions as Ory Keto tuples.
package keto

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Relation is what a subject may do with an object.
type Relation string

const (
	// Owner may do anything, including sharing and deleting.
	RelOwner Relation = "owner"
	// Editor may change the object but not share or delete it.
	RelEditor Relation = "editor"
	// Viewer may only read.
	RelViewer Relation = "viewer"
)

// ErrSelector refuses an empty field Keto would match as any value, widening a delete or a list.
var ErrSelector = errors.New("keto: empty selector")

// selector returns ErrSelector naming the first empty field.
func selector(fields ...string) error {
	for i := 0; i+1 < len(fields); i += 2 {
		if fields[i+1] == "" {
			return fmt.Errorf("%w: %s", ErrSelector, fields[i])
		}
	}
	return nil
}

// Tuple is one permission fact: subject holds relation on namespace:object.
type Tuple struct {
	Namespace string   `json:"namespace"`
	Object    string   `json:"object"`
	Relation  Relation `json:"relation"`
	Subject   string   `json:"subject_id"`
}

type Options struct {
	// ReadURL is Keto's read API, e.g. http://127.0.0.1:4466.
	ReadURL string
	// WriteURL is Keto's write API, e.g. http://127.0.0.1:4467.
	WriteURL string
	Client   *http.Client
	Timeout  time.Duration
}

func (o *Options) defaults() {
	if o.Timeout <= 0 {
		o.Timeout = 5 * time.Second
	}
	if o.Client == nil {
		o.Client = &http.Client{Timeout: o.Timeout}
	}
}

type Client struct{ opts Options }

func New(opts Options) (*Client, error) {
	if opts.ReadURL == "" || opts.WriteURL == "" {
		return nil, fmt.Errorf("keto: ReadURL and WriteURL are required")
	}
	opts.defaults()
	return &Client{opts: opts}, nil
}

// Check asks whether a subject holds a relation on an object; on error it returns false, never a permit.
func (c *Client) Check(ctx context.Context, t Tuple) (bool, error) {
	query := url.Values{}
	query.Set("namespace", t.Namespace)
	query.Set("object", t.Object)
	query.Set("relation", string(t.Relation))
	query.Set("subject_id", t.Subject)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.opts.ReadURL+"/relation-tuples/check?"+query.Encode(), nil)
	if err != nil {
		return false, fmt.Errorf("keto: request: %w", err)
	}

	resp, err := c.opts.Client.Do(req)
	if err != nil {
		return false, fmt.Errorf("keto: check: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusForbidden:
		// Keto answers 403 for a denied check.
		return false, nil
	default:
		return false, fmt.Errorf("keto: check returned %d", resp.StatusCode)
	}

	var body struct {
		Allowed bool `json:"allowed"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return false, fmt.Errorf("keto: decode check: %w", err)
	}
	return body.Allowed, nil
}

// Allowed reports whether the subject holds any of the relations.
func (c *Client) Allowed(ctx context.Context, t Tuple, relations ...Relation) (bool, error) {
	for _, rel := range relations {
		probe := t
		probe.Relation = rel

		ok, err := c.Check(ctx, probe)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}

// Write creates a tuple. Writing an existing tuple succeeds.
func (c *Client) Write(ctx context.Context, t Tuple) error {
	body, err := json.Marshal(t)
	if err != nil {
		return fmt.Errorf("keto: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut,
		c.opts.WriteURL+"/admin/relation-tuples", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("keto: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.opts.Client.Do(req)
	if err != nil {
		return fmt.Errorf("keto: write: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("keto: write returned %d", resp.StatusCode)
	}
	return nil
}

// Delete removes a tuple. Removing a missing tuple succeeds.
func (c *Client) Delete(ctx context.Context, t Tuple) error {
	if err := selector("namespace", t.Namespace, "object", t.Object, "relation", string(t.Relation), "subject", t.Subject); err != nil {
		return err
	}
	query := url.Values{}
	query.Set("namespace", t.Namespace)
	query.Set("object", t.Object)
	query.Set("relation", string(t.Relation))
	query.Set("subject_id", t.Subject)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		c.opts.WriteURL+"/admin/relation-tuples?"+query.Encode(), nil)
	if err != nil {
		return fmt.Errorf("keto: request: %w", err)
	}

	resp, err := c.opts.Client.Do(req)
	if err != nil {
		return fmt.Errorf("keto: delete: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("keto: delete returned %d", resp.StatusCode)
	}
	return nil
}

// Subjects lists who holds a relation on an object.
func (c *Client) Subjects(ctx context.Context, namespace, object string, rel Relation) ([]string, error) {
	if err := selector("namespace", namespace, "object", object, "relation", string(rel)); err != nil {
		return nil, err
	}
	query := url.Values{}
	query.Set("namespace", namespace)
	query.Set("object", object)
	query.Set("relation", string(rel))

	tuples, err := c.list(ctx, query)
	if err != nil {
		return nil, err
	}

	out := make([]string, 0, len(tuples))
	for _, t := range tuples {
		out = append(out, t.Subject)
	}
	return out, nil
}

// Objects lists what a subject holds a relation on.
func (c *Client) Objects(ctx context.Context, namespace, subject string, rel Relation) ([]string, error) {
	if err := selector("namespace", namespace, "subject", subject, "relation", string(rel)); err != nil {
		return nil, err
	}
	query := url.Values{}
	query.Set("namespace", namespace)
	query.Set("relation", string(rel))
	query.Set("subject_id", subject)

	tuples, err := c.list(ctx, query)
	if err != nil {
		return nil, err
	}

	out := make([]string, 0, len(tuples))
	for _, t := range tuples {
		out = append(out, t.Object)
	}
	return out, nil
}

// list follows next_page_token through every page, since one page would truncate silently.
func (c *Client) list(ctx context.Context, query url.Values) ([]Tuple, error) {
	query.Set("page_size", "500")

	var all []Tuple
	for {
		page, next, err := c.listPage(ctx, query)
		if err != nil {
			return nil, err
		}
		all = append(all, page...)
		if next == "" {
			return all, nil
		}
		// A repeated token would loop forever.
		if next == query.Get("page_token") {
			return nil, fmt.Errorf("keto: list repeated page token %q", next)
		}
		query.Set("page_token", next)
	}
}

func (c *Client) listPage(ctx context.Context, query url.Values) ([]Tuple, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.opts.ReadURL+"/relation-tuples?"+query.Encode(), nil)
	if err != nil {
		return nil, "", fmt.Errorf("keto: request: %w", err)
	}

	resp, err := c.opts.Client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("keto: list: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("keto: list returned %d", resp.StatusCode)
	}

	var body struct {
		RelationTuples []Tuple `json:"relation_tuples"`
		NextPageToken  string  `json:"next_page_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, "", fmt.Errorf("keto: decode list: %w", err)
	}
	return body.RelationTuples, body.NextPageToken, nil
}
