'use strict';

const { Contract } = require('fabric-contract-api');

class BloodBank extends Contract {
    async InitLedger(ctx) {
        console.log('Initializing the ledger...');
        await this.initBloodInventory(ctx); // Initialize blood inventory
    }

    // Updated registerDonor function
    async registerDonor(ctx, donorID, donorName, bloodType, age, phoneNumber) {
        // Validate the input parameters
        if (!donorID || !donorName || !bloodType || !age || !phoneNumber) {
            throw new Error('All fields (donorID, donorName, bloodType, age, phoneNumber) are required.');
        }
    
        const donor = {
            donorID,
            donorName,
            bloodType,
            age: parseInt(age), // Convert age to number
            phoneNumber,
            lastDonationDate: null,
            donationHistory: [],
        };
    
        await ctx.stub.putState(donorID, Buffer.from(JSON.stringify(donor)));
        return JSON.stringify({ message: 'Donor registered successfully.', donorID });
    }
    
    // New donate function
    async donate(ctx, donorID, bloodType, quantity, donationDate) {
        // Validate the input parameters
        if (!donorID || !bloodType || isNaN(parseInt(quantity)) || !donationDate) {
            throw new Error('All fields (donorID, bloodType, quantity, donationDate) are required.');
        }

        const parsedQuantity = parseInt(quantity, 10);
        
        // Validate quantity
        if (parsedQuantity <= 0) {
            throw new Error('Invalid or negative quantity provided.');
        }

        // Update the blood inventory
        const inventoryKey = `inventory_${bloodType}`;
        const inventoryBuffer = await ctx.stub.getState(inventoryKey);
        if (!inventoryBuffer || inventoryBuffer.length === 0) {
            throw new Error(`No inventory found for blood type ${bloodType}`);
        }

        const inventory = JSON.parse(inventoryBuffer.toString());
        inventory.quantity += parsedQuantity; // Increment the inventory by quantity

        // Update the inventory in the ledger
        await ctx.stub.putState(inventoryKey, Buffer.from(JSON.stringify(inventory)));

        // Add the donation details to the donor's record
        const donorBuffer = await ctx.stub.getState(donorID);
        if (!donorBuffer || donorBuffer.length === 0) {
          throw new Error(`Donor with ID ${donorID} does not exist.`);
       }

        const donor = JSON.parse(donorBuffer.toString());
        donor.lastDonationDate = donationDate; // Update the last donation date
        //donor.donationHistory.push({ bloodType, quantity: parsedQuantity, donationDate });

        // Update donor's state in the ledger
        await ctx.stub.putState(donorID, Buffer.from(JSON.stringify(donor)));

        return JSON.stringify({
            message: 'Donation recorded successfully.',
            updatedInventory: inventory,
        });
    }

    // Method to generate a unique donor ID (you can customize this as needed)
    

    async updateBloodInventory(ctx, bloodType, quantity) {
        const inventoryKey = `inventory_${bloodType}`;
    
        // Validate the bloodType and quantity
        if (!bloodType || isNaN(parseInt(quantity))) {
            throw new Error('Valid bloodType and quantity are required.');
        }
    
        // Check if the blood type inventory exists
        const inventoryBuffer = await ctx.stub.getState(inventoryKey);
        if (!inventoryBuffer || inventoryBuffer.length === 0) {
            throw new Error(`Blood type ${bloodType} does not exist in the inventory.`);
        }
    
        // Parse existing inventory
        const inventory = JSON.parse(inventoryBuffer.toString());
    
        // Update the quantity
        inventory.quantity += parseInt(quantity);
        if (inventory.quantity < 0) {
            throw new Error('Quantity cannot be negative.');
        }
    
        // Save the updated inventory back to the ledger
        await ctx.stub.putState(inventoryKey, Buffer.from(JSON.stringify(inventory)));
        return JSON.stringify(inventory);
    }
    

    async requestBlood(ctx, requestID, bloodType, quantity, timestamp) {
        // Convert quantity to integer and validate
        const parsedQuantity = parseInt(quantity, 10);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error('Invalid or negative quantity provided.');
        }
    
        const inventoryKey = `inventory_${bloodType}`;
        
        // Fetch the inventory for the requested blood type
        const inventoryBuffer = await ctx.stub.getState(inventoryKey);
        if (!inventoryBuffer || inventoryBuffer.length === 0) {
            throw new Error(`No inventory found for blood type ${bloodType}`);
        }
    
        let inventory;
        try {
            inventory = JSON.parse(inventoryBuffer.toString());
        } catch (error) {
            throw new Error(`Failed to parse inventory for blood type ${bloodType}: ${error.message}`);
        }
    
        // Log the current inventory for debugging purposes
        console.log(`Inventory before update: ${JSON.stringify(inventory)}`);
    
        // Check if there's enough blood in the inventory
        if (inventory.quantity < parsedQuantity) {
            throw new Error(`Insufficient blood of type ${bloodType}. Available: ${inventory.quantity}`);
        }
    
        // Deduct the quantity from the inventory
        inventory.quantity -= parsedQuantity;
    
        // Update the inventory in the ledger with error handling
        try {
            await ctx.stub.putState(inventoryKey, Buffer.from(JSON.stringify(inventory)));
        } catch (error) {
            throw new Error(`Failed to update inventory for blood type ${bloodType}: ${error.message}`);
        }
    
        // Log the updated inventory
        console.log(`Inventory after update: ${JSON.stringify(inventory)}`);
    
        // Log the blood request
        const request = {
            requestID,
            bloodType,
            quantity: parsedQuantity,
            timestamp: timestamp || new Date().toISOString(), // Use passed timestamp or generate one
        };
    
        // Save the request in the ledger
        try {
            await ctx.stub.putState(requestID, Buffer.from(JSON.stringify(request)));
        } catch (error) {
            throw new Error(`Failed to save request ${requestID}: ${error.message}`);
        }
    
        // Return the request and updated inventory as JSON
        return JSON.stringify({
            request,
            updatedInventory: inventory,
        });
    }

    async initBloodInventory(ctx) {
        const bloodTypes = ['A', 'B', 'O', 'AB'];

        // Initialize inventory for each blood type with a base quantity of 100 units
        for (const bloodType of bloodTypes) {
            const inventoryKey = `inventory_${bloodType}`;
            const inventory = {
                bloodType,
                quantity: 100,  // Set initial quantity
            };
            await ctx.stub.putState(inventoryKey, Buffer.from(JSON.stringify(inventory)));
        }

        return 'Blood inventory initialized';
    }

    async getDonor(ctx, donorID) {
        const donorBuffer = await ctx.stub.getState(donorID);
        if (!donorBuffer || donorBuffer.length === 0) {
            throw new Error(`Donor with ID ${donorID} does not exist.`);
        }
        return donorBuffer.toString();
    }

    async getBloodInventory(ctx, bloodType) {
        const inventoryKey = `inventory_${bloodType}`;
        const inventoryBuffer = await ctx.stub.getState(inventoryKey);
        if (!inventoryBuffer || inventoryBuffer.length === 0) {
            throw new Error(`No inventory found for blood type ${bloodType}`);
        }
        return inventoryBuffer.toString();
    }

    async getDonationHistory(ctx, donorID) {
        const donorBuffer = await ctx.stub.getState(donorID);
        if (!donorBuffer || donorBuffer.length === 0) {
            throw new Error(`Donor with ID ${donorID} does not exist.`);
        }
        const donor = JSON.parse(donorBuffer.toString());
        return JSON.stringify(donor.donationHistory);
    }

    async addDonationToHistory(ctx, donorID, donationDetails) {
        const donorBuffer = await ctx.stub.getState(donorID);
        if (!donorBuffer || donorBuffer.length === 0) {
            throw new Error(`Donor with ID ${donorID} does not exist.`);
        }

        // Validate donationDetails before adding to history
        if (!donationDetails || !donationDetails.date || !donationDetails.quantity) {
            throw new Error('Donation details must include date and quantity.');
        }

        const donor = JSON.parse(donorBuffer.toString());
        donor.donationHistory.push(donationDetails);

        await ctx.stub.putState(donorID, Buffer.from(JSON.stringify(donor)));
        return JSON.stringify(donor);
    }
}

module.exports = BloodBank;
