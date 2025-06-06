// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CoinFlip {
    address public owner;

    event GameResult(
        address player,
        uint256 bet,
        bool choice,
        bool result,
        bool won,
        uint256 payout
    );

    constructor() {
        owner = msg.sender;
    }

    function flipCoin(bool choice) external payable {
        require(msg.value > 0, "Must bet something");

        uint256 payout = (msg.value * 3) / 2; // 1.5x
        require(
            address(this).balance >= payout,
            "Not enough funds in contract"
        );

        // Simple random: true = heads, false = tails
        bool result = block.timestamp % 2 == 0;

        if (result == choice) {
            payable(msg.sender).transfer(payout);
            emit GameResult(
                msg.sender,
                msg.value,
                choice,
                result,
                true,
                payout
            );
        } else {
            emit GameResult(msg.sender, msg.value, choice, result, false, 0);
        }
    }

    // Owner adds funds
    function addFunds() external payable {
        require(msg.sender == owner, "Only owner");
    }

    // Owner withdraws funds
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
