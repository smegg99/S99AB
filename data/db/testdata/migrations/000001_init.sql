-- +goose Up
CREATE TABLE parent (id INTEGER PRIMARY KEY);
CREATE TABLE child (
  id        INTEGER PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES parent(id)
);

-- +goose Down
DROP TABLE child;
DROP TABLE parent;
