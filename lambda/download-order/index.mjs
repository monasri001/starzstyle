function json(statusCode, message) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({ message }),
    isBase64Encoded: false,
  };
}

function validItem(item) {
  return item
    && item.product
    && typeof item.product.name === "string"
    && typeof item.product.color === "string"
    && Number.isFinite(item.product.price)
    && Number.isInteger(item.quantity)
    && item.quantity > 0;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== "POST") {
    return json(405, "Only POST requests are allowed");
  }

  try {
    const order = JSON.parse(event.body || "{}");
    if (
      typeof order.orderNumber !== "string"
      || typeof order.name !== "string"
      || typeof order.address !== "string"
      || typeof order.placedAt !== "string"
      || !Number.isFinite(order.subtotal)
      || !Array.isArray(order.items)
      || order.items.length === 0
      || !order.items.every(validItem)
    ) {
      return json(400, "Invalid order details");
    }

    const itemLines = order.items.map(({ product, quantity }, index) =>
      `${index + 1}. ${product.name} (${product.color}) x${quantity} - ₹${(product.price * quantity).toLocaleString("en-IN")}`,
    );
    const receipt = [
      "STARZSTYLE ORDER RECEIPT",
      "========================",
      `Order number: ${order.orderNumber}`,
      `Placed at: ${order.placedAt}`,
      `Customer: ${order.name}`,
      "Delivery address:",
      order.address,
      "",
      "ITEMS",
      ...itemLines,
      "",
      `Total: ₹${order.subtotal.toLocaleString("en-IN")}`,
      "Payment: Cash on delivery (demo)",
      "",
      "Thank you for shopping with StarzStyle.",
    ].join("\n");
    const safeOrderNumber = order.orderNumber.replace(/[^a-zA-Z0-9-]/g, "");

    console.log("Generated order receipt", safeOrderNumber);

    return {
      statusCode: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="starzstyle-${safeOrderNumber}.txt"`,
        "cache-control": "no-store",
      },
      body: receipt,
      isBase64Encoded: false,
    };
  } catch (error) {
    console.error("Receipt generation failed", error);
    return json(500, "Unable to generate the order receipt");
  }
};
