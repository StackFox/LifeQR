# Prompt: Integrating NFC Inventory System into an Existing Expo Project

Use this prompt to guide an AI assistant in integrating the NFC Inventory Management System from Francesco Piscani's tutorial into your current Expo project.

---

### **Context**
I have an existing Expo project built with **React Native** and **Expo Router**. I want to integrate an **NFC Inventory Management System**. I have the architecture details from a tutorial series that uses:
- `react-native-nfc-manager` for hardware interaction.
- `@react-native-async-storage/async-storage` for local data persistence.
- **Expo Router** for file-based navigation.
- **TypeScript (TSX)** for implementation.

### **The Goal**
Integrate a scanning module, an inventory storage utility, and a reporting system into my current codebase without breaking existing navigation.

---

### **Task Instructions**

#### **1. Dependency Setup**
Install the necessary libraries and configure the `app.json` (or `app.config.js`) for NFC permissions.
- **Libraries:** `react-native-nfc-manager`, `@react-native-async-storage/async-storage`.
- **Permissions:** Add `com.apple.developer.nfc.readersession.formats` for iOS and `android.permission.NFC` for Android.

#### **2. Storage Utility (Services Layer)**
Create a `services/inventoryStorage.ts` file to handle:
- `saveInventoryItem(item)`: Save/update items in Async Storage.
- `getInventoryItem(id)`: Retrieve a single item by its NFC tag ID.
- `getAllItems()`: Fetch the full inventory list.
- `deleteItem(id)`: Remove an item.

#### **3. NFC Scanning Logic**
Implement a reusable `ScanScreen` or Hook that:
- Initializes the `NfcManager`.
- Handles `requestTechnology` (Ndef or NfcV).
- Logic check: If tag ID exists in storage -> navigate to `ItemDetails`; if not -> navigate to `AddItem`.
- Implements a "Hard Reset" function to clean up the NFC session on component unmount.

#### **4. UI/Screen Integration**
Create the following screens within the `app/` directory:
- `app/scan/index.tsx`: The scanning interface.
- `app/inventory/[id].tsx`: Dynamic route for item details and quantity updates.
- `app/inventory/add.tsx`: Form to register new tags.
- `app/reports/index.tsx`: Summary view (Total items, category breakdown, CSV export logic).

#### **5. Technical Constraints**
- Use **TypeScript** interfaces for `InventoryItem` (id, name, description, quantity, location, category, timestamps).
- Ensure the NFC manager is properly wrapped in `try/catch/finally` blocks to prevent hardware lock-up.
- Use `useLocalSearchParams` from `expo-router` to pass tag IDs between screens.

---

### **Execution Request**
"Please provide the TypeScript code for the `inventoryStorage.ts` utility and the core `ScanScreen.tsx` component, ensuring it follows the Expo Router patterns and handles hardware initialization correctly."
