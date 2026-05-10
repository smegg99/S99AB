// mail/mailer/templates.go

package mailer

import (
	"bytes"
	"fmt"
	"html/template"
	"io/fs"
	"strings"
	tt "text/template"
)

// Templates holds one finished HTML document and one plain alternative per name.
type Templates struct {
	html *template.Template
	text *tt.Template
}

// Parse uses text/template for the plain set so it is not HTML-escaped.
func Parse(fsys fs.FS, htmlGlob, textGlob string) (*Templates, error) {
	h, err := template.New("html").ParseFS(fsys, htmlGlob)
	if err != nil {
		return nil, fmt.Errorf("mailer: parse html: %w", err)
	}
	t, err := tt.New("text").ParseFS(fsys, textGlob)
	if err != nil {
		return nil, fmt.Errorf("mailer: parse text: %w", err)
	}
	return &Templates{html: h, text: t}, nil
}

// Render executes both halves for one name and fails when the plain one is missing.
func (t *Templates) Render(name string, data any) (Message, error) {
	var m Message

	html := t.html.Lookup(name + ".html")
	if html == nil {
		return m, fmt.Errorf("mailer: no html template %q", name)
	}
	text := t.text.Lookup(name + ".txt")
	if text == nil {
		return m, fmt.Errorf("mailer: no text template %q", name)
	}

	var hb bytes.Buffer
	if err := html.Execute(&hb, data); err != nil {
		return m, fmt.Errorf("mailer: render %s.html: %w", name, err)
	}
	var tb bytes.Buffer
	if err := text.Execute(&tb, data); err != nil {
		return m, fmt.Errorf("mailer: render %s.txt: %w", name, err)
	}

	m.HTML = hb.String()
	m.Text = strings.TrimSpace(tb.String()) + "\n"
	return m, nil
}

// Names lists the templates that have both halves.
func (t *Templates) Names() []string {
	var out []string
	for _, tmpl := range t.html.Templates() {
		name := strings.TrimSuffix(tmpl.Name(), ".html")
		if name == tmpl.Name() {
			continue
		}
		if t.text.Lookup(name+".txt") != nil {
			out = append(out, name)
		}
	}
	return out
}
