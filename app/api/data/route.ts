const ESP = process.env.ESP_API_URL!;
const AUTH = "Basic " + Buffer.from(`${process.env.ESP_API_USER}:${process.env.ESP_API_PASS}`).toString("base64");

const headers = {
  Authorization: AUTH,
  "Content-Type": "application/json",
};

async function proxy(req: Request, method: string) {
  const { search } = new URL(req.url);
  const url = `${ESP}/data${search}`;
  const body = method !== "GET" && method !== "DELETE" ? await req.text() : undefined;

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) { return proxy(req, "GET"); }
export async function POST(req: Request) { return proxy(req, "POST"); }
export async function PUT(req: Request) { return proxy(req, "PUT"); }
export async function DELETE(req: Request) { return proxy(req, "DELETE"); }
