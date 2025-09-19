const { ethers } = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const constructorArgs = process.env.CONSTRUCTOR_ARGS;

    if (!contractAddress) {
        console.error("Please set CONTRACT_ADDRESS environment variable");
        process.exit(1);
    }

    console.log("Verifying contract at:", contractAddress);

    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: constructorArgs ? JSON.parse(constructorArgs) : [],
        });
        console.log("Contract verified successfully!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("Contract is already verified");
        } else {
            console.error("Verification failed:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
