// auth/kratosclient/flow.go

package kratosclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// Text is a label or a message Kratos wrote.
type Text struct {
	// ID is Kratos's stable message id, used for translation. Always serialized.
	ID   int64  `json:"id"`
	Text string `json:"text"`
	Type string `json:"type"`
}

// Attributes describes one form field.
type Attributes struct {
	Name         string `json:"name,omitempty"`
	Type         string `json:"type,omitempty"`
	Value        any    `json:"value,omitempty"`
	Required     bool   `json:"required,omitempty"`
	Disabled     bool   `json:"disabled,omitempty"`
	Autocomplete string `json:"autocomplete,omitempty"`
	Text         *Text  `json:"text,omitempty"`
	Src          string `json:"src,omitempty"`
	Href         string `json:"href,omitempty"`
	Title        *Text  `json:"title,omitempty"`
	// OnClick is Kratos's WebAuthn JavaScript, passed through and never evaluated here.
	OnClick string `json:"onclick,omitempty"`
}

// NodeMeta carries a field's label.
type NodeMeta struct {
	Label *Text `json:"label,omitempty"`
}

// Node is one form element: a field, a button, an image or a line of text.
type Node struct {
	Type       string     `json:"type"`
	Group      string     `json:"group"`
	Attributes Attributes `json:"attributes"`
	Meta       *NodeMeta  `json:"meta,omitempty"`
	Messages   []Text     `json:"messages,omitempty"`
}

// Flow is one Kratos flow as a caller has to render it.
type Flow struct {
	ID       string `json:"id"`
	Action   string `json:"action"`
	Method   string `json:"method"`
	Nodes    []Node `json:"nodes"`
	Messages []Text `json:"messages,omitempty"`
}

// wireFlow is Kratos's own shape, which nests the form under ui.
type wireFlow struct {
	ID string `json:"id"`
	UI struct {
		Action   string `json:"action"`
		Method   string `json:"method"`
		Nodes    []Node `json:"nodes"`
		Messages []Text `json:"messages"`
	} `json:"ui"`
}

func (w wireFlow) flow() Flow {
	return Flow{
		ID: w.ID, Action: w.UI.Action, Method: w.UI.Method,
		Nodes: w.UI.Nodes, Messages: w.UI.Messages,
	}
}

// BeginLogin asks Kratos for a login flow and returns the form it wants.
func (c *Client) BeginLogin(ctx context.Context) (Flow, error) {
	var answer wireFlow
	if err := c.call(ctx, http.MethodGet, "/self-service/login/api", "", nil, &answer); err != nil {
		return Flow{}, err
	}
	return answer.flow(), nil
}

// SubmitLogin sends the flow's values. It returns a session token, or the
// refused flow with its messages; err is set only when neither came back.
func (c *Client) SubmitLogin(ctx context.Context, flowID string,
	values map[string]any) (token string, again Flow, err error) {

	var answer struct {
		wireFlow
		SessionToken string `json:"session_token"`
	}
	path := "/self-service/login?flow=" + url.QueryEscape(flowID)
	err = c.call(ctx, http.MethodPost, path, "", values, &answer)
	if err == nil {
		if answer.SessionToken == "" {
			return "", Flow{}, fmt.Errorf("kratosclient: sign-in answered without a session token")
		}
		return answer.SessionToken, Flow{}, nil
	}

	// A refusal returns the flow with its messages filled in.
	var answered *status
	if refused, ok := asStatus(err, &answered); ok && refused < 500 {
		if next, decoded := decodeFlow(answered.body); decoded {
			return "", next, nil
		}
	}
	return "", Flow{}, err
}

func decodeFlow(body []byte) (Flow, bool) {
	var answer wireFlow
	if err := json.Unmarshal(body, &answer); err != nil || answer.ID == "" {
		return Flow{}, false
	}
	return answer.flow(), true
}
