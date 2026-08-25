/**
 * Seed test accounts with proper scrypt password hashes.
 * Run: cd phase1inspect && npx tsx seed-accounts.ts
 */
import * as fs from "fs";
import * as path from "path";
import { hashPassword } from "./server/services/memberAuthService";

async function main() {
  const storePath = path.join(".data", "membership-store.json");
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));

  // 1. Set superadmin password
  const sa = store.users.find((u: any) => u.role === "superadmin");
  if (sa) {
    sa.passwordHash = await hashPassword("SuperAdmin@123");
    sa.passwordSetupRequired = false;
    sa.email = "superadmin@msapakistan.org";
    sa.name = "Super Admin";
    console.log(`✅ Super admin: ${sa.email} / SuperAdmin@123`);
  }

  // 2. Set admin password  
  const admin = store.users.find((u: any) => u.role === "admin" && u.passwordHash);
  if (admin) {
    admin.passwordHash = await hashPassword("Admin@12345");
    admin.passwordSetupRequired = false;
    console.log(`✅ Admin: ${admin.email} / Admin@12345`);
  }

  // 3. Create/update regular user
  let user = store.users.find((u: any) => u.email === "user@msap.org");
  if (!user) {
    user = {
      id: (store.users.length > 0 ? Math.max(...store.users.map((u: any) => u.id)) : 0) + 1,
      openId: "member:user@msap.org",
      email: "user@msap.org",
      name: "Test Member",
      role: "user",
      membershipStatus: "Active",
      membershipId: "MSAP-MBR-001",
      localCouncil: "KEMU-LC",
      institution: "King Edward Medical University",
      active: true,
      sessionEpoch: 0,
      loginMethod: "member-password",
      cnic: null,
      phone: "+92-300-1234567",
      degree: "MBBS",
      graduationYear: 2027,
      profilePhotoUrl: null,
      bio: null,
      officialPosition: null,
      domain: null,
      moduleAccess: null,
      standingCommittee: null,
      termStart: null,
      termEnd: null,
      affiliatedChapterId: null,
      localCouncilId: null,
      membershipStartDate: null,
      membershipEndDate: null,
      discipline: "Medicine",
      yearOfStudy: "4th Year",
      passwordHash: await hashPassword("Member@12345"),
      passwordSetupRequired: false,
      setupTokenHash: null,
      setupTokenExpiresAt: null,
      setupTokenUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: null,
    };
    store.users.push(user);
  } else {
    user.passwordHash = await hashPassword("Member@12345");
    user.passwordSetupRequired = false;
  }
  console.log(`✅ User: user@msap.org / Member@12345`);

  // 4. Create/update official user
  let official = store.users.find((u: any) => u.email === "official@msap.org");
  if (!official) {
    official = {
      id: (store.users.length > 0 ? Math.max(...store.users.map((u: any) => u.id)) : 0) + 1,
      openId: "official:official@msap.org",
      email: "official@msap.org",
      name: "Test Official",
      role: "official",
      officialPosition: "vpa",
      membershipStatus: "Active",
      membershipId: null,
      localCouncil: "National",
      institution: "MSAP National",
      active: true,
      sessionEpoch: 0,
      loginMethod: "member-password",
      cnic: null,
      phone: null,
      degree: null,
      graduationYear: null,
      profilePhotoUrl: null,
      bio: null,
      domain: "activities",
      moduleAccess: ["membership", "activities", "events"],
      standingCommittee: null,
      termStart: null,
      termEnd: null,
      affiliatedChapterId: null,
      localCouncilId: null,
      membershipStartDate: null,
      membershipEndDate: null,
      discipline: null,
      yearOfStudy: null,
      passwordHash: await hashPassword("Official@123"),
      passwordSetupRequired: false,
      setupTokenHash: null,
      setupTokenExpiresAt: null,
      setupTokenUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: null,
    };
    store.users.push(official);
  } else {
    official.passwordHash = await hashPassword("Official@123");
    official.passwordSetupRequired = false;
  }
  console.log(`✅ Official: official@msap.org / Official@123`);

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  console.log("\n✅ All accounts seeded. Restart server to pick up changes.");
}

main().catch(console.error);
