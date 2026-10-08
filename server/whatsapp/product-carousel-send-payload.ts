/**
 * Build Meta Cloud API product carousel template send payload.
 * Template is created with placeholder product headers; real products are set at send time.
 */
export type ProductCardSendMeta = {
  productRetailerId: string;
};

export function buildProductCarouselSendPayload(
  catalogId: string,
  productCards: ProductCardSendMeta[]
): { cards: Array<Record<string, unknown>> } {
  const catalog = catalogId.trim();
  if (!catalog) {
    throw new Error("Meta catalog ID is required to send product carousel templates");
  }

  const cards = productCards
    .map((card, index) => {
      const retailerId = String(card.productRetailerId || "").trim();
      if (!retailerId) return null;
      return {
        card_index: index,
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "product",
                product: {
                  catalog_id: catalog,
                  product_retailer_id: retailerId,
                },
              },
            ],
          },
        ],
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (cards.length < 1) {
    throw new Error("At least one product with a retailer ID is required");
  }

  return { cards };
}
