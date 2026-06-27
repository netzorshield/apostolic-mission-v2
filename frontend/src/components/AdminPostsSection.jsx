import { useState } from "react";
import MissionFeed from "./MissionFeed";

/** Admin-published announcements & uploads — separate from the Mission (referral) section. */
export default function AdminPostsSection() {
  const [hasPosts, setHasPosts] = useState(null);

  if (hasPosts === false) return null;

  return (
    <section className="mb-10">
      <MissionFeed
        embedded
        hideWhenEmpty
        onLoaded={(posts) => setHasPosts(posts.length > 0)}
      />
    </section>
  );
}
