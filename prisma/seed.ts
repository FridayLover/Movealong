import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

const U = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

async function main(){
  const hash = await bcrypt.hash("123456", 10);

  const demo = await prisma.user.upsert({
    where: { email: "demo@movealong.test" },
    update: { name: "Demo User", building: "Ideo Sukhumvit 93", bio: "Moving out in 2 weeks — everything must go. Pickup at lobby, evenings.", phone: "+66 81 234 5678", credits: 12, tagline: "Moving out · everything must go by Sunday", pronouns: "they/them", languages: JSON.stringify(["English", "Thai"]), accent: "terracotta", coverImage: U("photo-1522708323590-d24dbb6b0267", 1600), pickupBadges: JSON.stringify(["elevator", "evenings", "weekends"]), prefDistanceKm: 10, prefCategories: JSON.stringify(["furniture", "decor"]), prefStyle: "cozy warm" },
    create: { email: "demo@movealong.test", name: "Demo User", passwordHash: hash, building: "Ideo Sukhumvit 93", address: "Sukhumvit 93, Bangkok", lat: 13.7307, lng: 100.5601, credits: 12, subscriptionTier: "free", bio: "Moving out in 2 weeks — everything must go. Pickup at lobby, evenings.", phone: "+66 81 234 5678", tagline: "Moving out · everything must go by Sunday", pronouns: "they/them", languages: JSON.stringify(["English", "Thai"]), accent: "terracotta", coverImage: U("photo-1522708323590-d24dbb6b0267", 1600), pickupBadges: JSON.stringify(["elevator", "evenings", "weekends"]), prefDistanceKm: 10, prefCategories: JSON.stringify(["furniture", "decor"]), prefStyle: "cozy warm" }
  });
  const seller2 = await prisma.user.upsert({
    where: { email: "mild@movealong.test" },
    update: { tagline: "Student clear-out · free stuff first come", pronouns: "she/her", languages: JSON.stringify(["Thai", "English"]), accent: "sage", coverImage: U("photo-1560448204-e02f11c3d0e2", 1600), pickupBadges: JSON.stringify(["weekends", "help-carry"]) },
    create: { email: "mild@movealong.test", name: "Mild", passwordHash: hash, building: "Lumpini Park Rama 9", address: "Rama 9, Bangkok", lat: 13.7563, lng: 100.5650, credits: 3, bio: "Student moving back home. Free stuff first come first served.", tagline: "Student clear-out · free stuff first come", pronouns: "she/her", languages: JSON.stringify(["Thai", "English"]), accent: "sage", coverImage: U("photo-1560448204-e02f11c3d0e2", 1600), pickupBadges: JSON.stringify(["weekends", "help-carry"]) }
  });
  const seller3 = await prisma.user.upsert({
    where: { email: "ken@movealong.test" },
    update: { tagline: "Designer flat · like-new pieces, Ari", pronouns: "he/him", languages: JSON.stringify(["English", "Japanese"]), accent: "slate", coverImage: U("photo-1567016432779-0907d2e5a01b", 1600), pickupBadges: JSON.stringify(["elevator", "help-carry", "evenings"]), prefDistanceKm: 15, prefStyle: "warm modern" },
    create: { email: "ken@movealong.test", name: "Ken", passwordHash: hash, building: "Noble Around Ari", address: "Phahonyothin, Bangkok", lat: 13.774, lng: 100.536, credits: 8, subscriptionTier: "plus", bio: "Designer flat, good quality furniture.", tagline: "Designer flat · like-new pieces, Ari", pronouns: "he/him", languages: JSON.stringify(["English", "Japanese"]), accent: "slate", coverImage: U("photo-1567016432779-0907d2e5a01b", 1600), pickupBadges: JSON.stringify(["elevator", "help-carry", "evenings"]), prefDistanceKm: 15, prefStyle: "warm modern" }
  });

  await prisma.agentMessage.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.generation.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.savedSearch.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.listing.deleteMany({});

  const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  const listingsData = [
    {
      title: "IKEA MALM 6-drawer dresser — oak, good cond.",
      description: "Moving out next week. Few scratches on top but drawers slide perfectly — see close-up photo. You need a pickup truck or Lalamove. Self-pickup at lobby. Size accurate.",
      category: "furniture", condition: "good", price: 2200, originalPrice: 5900, isFree: false, moveOutDate: inDays(5), pickupNote: "Lobby · evenings after 18:00",
      width: 160, height: 78, depth: 48, unit: "cm",
      building: "Ideo Sukhumvit 93", address: "Sukhumvit 93, Bang Chak, Bangkok", lat: 13.7307, lng: 100.5601,
      images: [U("photo-1595428774223-ef52624120d2"), U("photo-1616486338812-3dadae4b4ace"), U("photo-1586023492125-27b2c045efd7")],
      sellerId: demo.id,
    },
    {
      title: "Mitsubishi 6.5kg washing machine — FREE",
      description: "Works fine, moving abroad and can't bring it. FREE — just come pick it up this weekend. Bring a friend and a trolley!",
      category: "appliance", condition: "fair", price: 0, originalPrice: 8900, isFree: true, moveOutDate: inDays(2), pickupNote: "Weekend only · bring trolley",
      width: 60, height: 85, depth: 55, unit: "cm",
      building: "Lumpini Park Rama 9", address: "Rama 9, Bangkok", lat: 13.7563, lng: 100.5650,
      images: [U("photo-1626806787461-102c1bfaaea1"), U("photo-1582735689369-4fe89db7114c")],
      sellerId: seller2.id,
    },
    {
      title: "3-seat fabric sofa — light grey, like new",
      description: "Bought 8 months ago, barely used. Non-smoking, no pets. Pickup with van. Can help carry to lobby. See fabric close-up — no stains.",
      category: "furniture", condition: "like_new", price: 6500, originalPrice: 15900, isFree: false, moveOutDate: inDays(12), pickupNote: "Van pickup · can help to lobby",
      width: 210, height: 85, depth: 95, unit: "cm",
      building: "Noble Around Ari", address: "Phahonyothin, Ari, Bangkok", lat: 13.774, lng: 100.536,
      images: [U("photo-1555041469-a586c61ea9bc"), U("photo-1540574163026-643ea20ade25")],
      sellerId: seller3.id,
    },
    {
      title: "Standing desk 120×60 + chair — FREE to good home",
      description: "Electric standing desk + ergonomic chair. Desk has small stain but height adjust works. Giving free to student/mover — must go before lease ends.",
      category: "furniture", condition: "good", price: 0, originalPrice: 12400, isFree: true, moveOutDate: inDays(3), pickupNote: "Today/tomorrow evening",
      width: 120, height: 75, depth: 60, unit: "cm",
      building: "Ideo Sukhumvit 93", address: "Sukhumvit 93, Bangkok", lat: 13.7315, lng: 100.561,
      images: [U("photo-1518455027359-f3f8164ba6bd"), U("photo-1506439773649-6e0eb8cfb237")],
      sellerId: demo.id,
    },
    {
      title: "Kitchen set — plates, pans, microwave",
      description: "Full kitchen lot for someone starting out. Microwave + pans + plates + utensils. Take all or split — bundle saves a trip.",
      category: "kitchen", condition: "good", price: 1200, originalPrice: 3400, isFree: false, moveOutDate: inDays(9), pickupNote: "Boxes ready at door",
      building: "Lumpini Park Rama 9", address: "Rama 9, Bangkok", lat: 13.755, lng: 100.566,
      images: [U("photo-1556911220-bff31c812dba"), U("photo-1556909212-d5b604d0c90d")],
      sellerId: seller2.id,
    },
    {
      title: "32-inch TV + wall mount",
      description: "LG 32\" smart TV with wall mount included. 1080p, remote included. 2 years old, screen perfect — see powered-on photo.",
      category: "electronics", condition: "good", price: 3500, originalPrice: 7990, isFree: false, moveOutDate: inDays(14),
      width: 73, height: 43, depth: 8, unit: "cm",
      building: "Noble Around Ari", address: "Ari, Bangkok", lat: 13.775, lng: 100.537,
      images: [U("photo-1593359677879-a4bb92f829d1"), U("photo-1593784991095-a205069470b6")],
      sellerId: seller3.id,
    },
    {
      title: "Wooden coffee table — walnut 90×55",
      description: "Solid wood, light wear on edge (see detail). Perfect for living room AI preview demos — pairs well with the grey sofa.",
      category: "furniture", condition: "good", price: 1800, originalPrice: 4500, isFree: false, moveOutDate: inDays(5),
      width: 90, height: 40, depth: 55, unit: "cm",
      building: "Ideo Sukhumvit 93", address: "Sukhumvit 93, Bangkok", lat: 13.7307, lng: 100.5601,
      images: [U("photo-1524758631624-e2822e304c36"), U("photo-1533090481720-856c6ea3c1f3")],
      sellerId: demo.id,
    },
    {
      title: "Floor lamp warm light — dimmable",
      description: "Warm 2700K, 3 brightness levels. Works great for cozy corners. Bulb included.",
      category: "decor", condition: "like_new", price: 650, originalPrice: 1890, isFree: false, moveOutDate: inDays(20),
      width: 30, height: 150, depth: 30, unit: "cm",
      building: "Lumpini Park Rama 9", address: "Rama 9, Bangkok", lat: 13.7563, lng: 100.5650,
      images: [U("photo-1507473885765-e6ed057f782c"), U("photo-1513506003901-1e6a229e2d15")],
      sellerId: seller2.id,
    },
  ] as const;

  const created: any[] = [];
  for(const l of listingsData){
    const c = await prisma.listing.create({ data: { ...l, images: JSON.stringify((l as any).images) } as any });
    created.push(c);
  }
  const [malm, wash, sofa, desk, kitchen, tv, coffeeTable, lamp] = created;

  const demoRoom = await prisma.room.create({
    data: { userId: demo.id, name: "My living room — Ideo", image: U("photo-1522708323590-d24dbb6b0267", 1200) }
  });
  await prisma.room.create({
    data: { userId: seller3.id, name: "Corner by window", image: U("photo-1560448204-e02f11c3d0e2", 1200) }
  });

  await prisma.favorite.createMany({
    data: [
      { userId: demo.id, listingId: sofa.id },
      { userId: demo.id, listingId: lamp.id },
      { userId: seller2.id, listingId: malm.id },
    ]
  });
  await prisma.cartItem.createMany({
    data: [
      { userId: demo.id, listingId: lamp.id },
      { userId: demo.id, listingId: tv.id },
      { userId: seller3.id, listingId: desk.id },
    ]
  });

  // Curated showcases for the chic storefronts (demo pins dresser + coffee table, Ken pins sofa)
  await prisma.user.update({ where: { id: demo.id }, data: { showcaseIds: JSON.stringify([malm.id, coffeeTable.id]) } });
  await prisma.user.update({ where: { id: seller3.id }, data: { showcaseIds: JSON.stringify([sofa.id]) } });

  // Demo saved search (buyer who wants a cheap sofa near Ideo) — created 2 days ago so seeded listings count as "new matches"
  const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  await prisma.savedSearch.create({
    data: { userId: demo.id, query: "sofa", category: "furniture", building: "Ideo", maxPrice: 7000, freeOnly: false, createdAt: twoDaysAgo }
  });

  await prisma.generation.create({
    data: {
      userId: demo.id,
      listingId: sofa.id,
      listingIds: JSON.stringify([sofa.id, coffeeTable.id]),
      roomId: demoRoom.id,
      roomImage: U("photo-1522708323590-d24dbb6b0267", 1200),
      resultImage: U("photo-1567016432779-0907d2e5a01b", 1200),
      prompt: "place against white wall, warm afternoon light",
      provider: "mock-canvas",
      creditsUsed: 1,
    }
  });
  await prisma.generation.create({
    data: {
      userId: demo.id,
      listingId: malm.id,
      listingIds: JSON.stringify([malm.id]),
      roomId: demoRoom.id,
      roomImage: U("photo-1522708323590-d24dbb6b0267", 1200),
      resultImage: U("photo-1484154218962-a197022b5858", 1200),
      prompt: "corner placement, soft shadows",
      provider: "mock-canvas",
      creditsUsed: 1,
    }
  });

  // Demo chat: demo (buyer) ↔ Ken (seller) about the sofa — so /chat isn't empty on first login
  const demoChat = await prisma.conversation.create({
    data: { buyerId: demo.id, sellerId: seller3.id, listingId: sofa.id }
  });
  await prisma.message.createMany({
    data: [
      { conversationId: demoChat.id, senderId: demo.id, body: "Hi Ken! Is the grey sofa still available? I saw it's like new — any stains?" },
      { conversationId: demoChat.id, senderId: seller3.id, body: "Hi! Yes, still available. No stains, non-smoking flat. You can check the fabric close-up in photo 2." },
      { conversationId: demoChat.id, senderId: demo.id, body: "Great. Can I pick up Saturday around 11:00 at the lobby? I'll bring a van." },
    ]
  });

  console.log(`Seeded ${created.length} listings, 2 rooms, 3 favorites, 3 cart items, 1 saved search, 2 generations, 1 chat thread`);
  console.log(`Demo user: demo@movealong.test / 123456 (credits: ${demo.credits}, tier: ${demo.subscriptionTier})`);
}

main().then(()=> prisma.$disconnect()).catch(e=>{ console.error(e); process.exit(1); });
