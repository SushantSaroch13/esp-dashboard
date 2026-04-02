const API = "/api";

// GET
export const fetchDataAPI = async (query: any) => {
  const params = new URLSearchParams();

  params.set("limit", String(query.limit || 20));

  if (query.start && query.end) {
    params.set("id", `${query.start}-${query.end}`);
  } else if (query.cursor) {
    params.set("cursor", String(query.cursor));
  } else {
    params.set("desc", "1");
  }

  const res = await fetch(`${API}/data?${params.toString()}`);
  return res.json();
};

// POST
export const insertAPI = async (body: any) => {
  await fetch(`${API}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

// DELETE
export const deleteAPI = async (id: number) => {
  await fetch(`${API}/data?id=${id}`, { method: "DELETE" });
};

// UPDATE
export const updateAPI = async (id: number, body: any) => {
  await fetch(`${API}/data?id=${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

// BULK
export const bulkAPI = async (body: string) => {
  await fetch(`${API}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
};
