import { getChatGPTUser } from "./chatgpt-auth";
import AlcoApp from "./alco-app";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const user = await getChatGPTUser();
  const { demo } = await searchParams;
  const demoMode = process.env.NODE_ENV !== "production" && demo === "1";

  return (
    <AlcoApp
      user={
        user
          ? { displayName: user.displayName, email: user.email }
          : demoMode
            ? { displayName: "Demo User", email: "demo@local" }
            : null
      }
      demo={demoMode}
    />
  );
}
