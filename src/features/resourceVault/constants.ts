export const DEFAULT_READ_TAGS = [
  "Read",
  "Watch",
  "Listen",
  "Browse",
  "Use",
  "Build",
  "Learn",
  "Join",
  "Follow",
] as const;

export const READ_TAG_COLORS: Record<string, string> = {
  Read: "read-tag-read",
  Watch: "read-tag-watch",
  Listen: "read-tag-listen",
  Browse: "read-tag-browse",
  Use: "read-tag-use",
  Build: "read-tag-build",
  Learn: "read-tag-learn",
  Join: "read-tag-join",
  Follow: "read-tag-follow",
};
