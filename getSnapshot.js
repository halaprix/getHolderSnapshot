const anchor = require("@project-serum/anchor");
const fs = require("fs");
const web3 = require("@solana/web3.js");
const connection = new anchor.web3.Connection(
  "https://solana-api.projectserum.com"
);

if (process.argv.length < 4) {
  console.log("Usage: node " + process.argv[1] + " inputFile outputFile");
  process.exit(1);
}

var inputFile = process.argv[2];
var outputFile = process.argv[3];

console.log(inputFile);

// @ts-ignore
var list = [];

const TOKEN_PUBKEY = new web3.PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const getNftOwner = async (address) => {
  try {
    let filter = {
      memcmp: {
        offset: 0,
        bytes: address,
      },
    };
    let filter2 = {
      dataSize: 165,
    };
    let getFilter = [filter, filter2];
    let programAccountsConfig = { filters: getFilter, encoding: "jsonParsed" };
    let _listOfTokens = await connection.getParsedProgramAccounts(
      TOKEN_PUBKEY,
      programAccountsConfig
    );

    let res;
    for (let i = 0; i < _listOfTokens.length; i++) {
      if (
        _listOfTokens[i]["account"]["data"]["parsed"]["info"]["tokenAmount"][
          "amount"
        ] == 1
      ) {
        res = _listOfTokens[i]["account"]["data"]["parsed"]["info"]["owner"];
        console.log(_listOfTokens[i]["account"]["data"]["parsed"]["info"]["owner"]);
        console.log(
          _listOfTokens[i]["account"]["data"]["parsed"]["info"]["tokenAmount"][
            "amount"
          ]);
      }
    }

    return res;
  } catch (e) {
    console.log(e);
  }
};

const owners = async () => {
  let newList = [];
  
  var data = fs.readFileSync(inputFile, "utf8", function (err, data) {
    if (err) throw err;
    console.log("OK: " + inputFile);     
  });
   data = data.replace(/[^a-zA-Z0-9]/g, " ").trim().replace(/[\s,]+/g,',').split(",")
console.log(data)
  for (let i = 0; i <= data.length-1; i++) {
    newList.push({ mint: data[i], holder: await getNftOwner(data[i]) });
    fs.writeFileSync(outputFile, JSON.stringify(newList));
  }
};

owners();
