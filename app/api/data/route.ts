async function proxy(req: Request, method: string) {
  const esp = process.env.ESP_API_URL;
  const user = process.env.ESP_API_USER;
  const pass = process.env.ESP_API_PASS;

  if (!esp || !user || !pass) {
    return new Response(
      JSON.stringify({ error: "Missing env vars", esp: !!esp, user: !!user, pass: !!pass }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const { search } = new URL(req.url);
  const url = `${esp}/data${search}`;
  const body = method !== "GET" && method !== "DELETE" ? await req.text() : undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Fetch failed", detail: String(err), url }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(req: Request) { return proxy(req, "GET"); }
export async function POST(req: Request) { return proxy(req, "POST"); }
export async function PUT(req: Request) { return proxy(req, "PUT"); }
export async function DELETE(req: Request) { return proxy(req, "DELETE"); }
