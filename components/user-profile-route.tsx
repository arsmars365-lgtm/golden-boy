"use client";

import { useParams } from "next/navigation";
import PublicProfilePage from "@/components/public-profile-page";

export default function UserProfileRoute() {
  const { username } = useParams<{ username: string }>();
  return <PublicProfilePage username={username} />;
}
