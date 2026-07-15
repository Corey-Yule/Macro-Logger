import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * POST /api/push/notify-admins { name: string }
 * Sends a "new food to review" push to every admin's subscribed devices.
 * Called by the client right after a community submission succeeds.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ sent: 0, reason: "push not configured" });
  }

  // Any signed-in user may trigger this (it's how submissions announce
  // themselves) — but nobody signed out.
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {},
    },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const foodName = body.name?.slice(0, 80) || "A new food";

  // Service role: read admin ids + their subscriptions across users
  const admin = createServiceClient(url, serviceKey);
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  const adminIds = (admins ?? []).map((a) => a.id);
  if (adminIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", adminIds);
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  webpush.setVapidDetails("mailto:coreyyule22@gmail.com", vapidPublic, vapidPrivate);
  const payload = JSON.stringify({
    title: "New food to review 🔍",
    body: `“${foodName}” was submitted to the community — tap to review.`,
    url: "/admin",
    tag: "review-queue",
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        // Expired/revoked subscription — clean it up
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
