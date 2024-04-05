const { ContractFactory, utils } = require("ethers")

const routerArtifact = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
const { ethers } = require("hardhat")

const {
    FlashbotsBundleProvider, FlashbotsBundleResolution
} = require("@flashbots/ethers-provider-bundle");


async function main() {
    let bundleTxs = []

    /* -----ПОКУПКА----- */
    let privateKey = "pk"
    let networkName = "mainnet"

    let provider = ethers.getDefaultProvider(networkName)

    let data = await provider.getFeeData()

    let owner = new ethers.Wallet(privateKey, provider);

    console.log("Make TX for buy for wallet:", owner.address, networkName, "...")
    const Router = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, owner)
    const router = Router.attach("pub_address")
    let currRouter = router.connect(owner)

    let tokenETHAmount = utils.parseUnits("0.005")

    const deadline = Math.floor(Date.now() / 1000 + (10 * 60))
    let swapExactETHForTokensTx = await currRouter.populateTransaction.swapExactETHForTokens(
        0,
        [
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH mainnet
            "0x00", // TOKEN address mainnet 
        ],
        owner.address,
        deadline,
        {
            value: tokenETHAmount,
            gasPrice: data.gasPrice.add(data.maxPriorityFeePerGas),
            gasLimit: utils.hexlify(300_000)
        }
    )


    swapExactETHForTokensTx.from = owner.address
    swapExactETHForTokensTx = await owner.populateTransaction(swapExactETHForTokensTx)

    let tx = {
        transaction: swapExactETHForTokensTx,
        signer: owner
    }

    bundleTxs.push(tx)

    console.log("done")

    let signPriveteKey = "pk" //Account 1
    let signer = new ethers.Wallet(signPriveteKey, provider);

    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        signer
    );


    const signedTransactions = await flashbotsProvider.signBundle(bundleTxs)
    const blockNum = await provider.getBlockNumber()

    const simulation = await flashbotsProvider.simulate(
        signedTransactions,
        blockNum + 10
    );

    //check errors here 
    console.log(simulation)

    const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        blockNum + 10
    );

    let resp = await bundleSubmission.wait()

    console.log(bundleSubmission)
    console.log(resp)
    console.log('Wait response', FlashbotsBundleResolution[resp])
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });