#!/bin/bash

# Step 1: Run the truffle migrate command
echo "Running truffle migrate..."
truffle migrate --network development

# Check if the truffle migrate command was successful
if [ $? -ne 0 ]; then
  echo "Truffle migrate failed. Exiting script."
  exit 1
fi

# Step 2: Delete all files in the target directory
TARGET_DIR="frontend-v2/public/contracts"
SOURCE_DIR="build/contracts"

echo "Deleting all files in the target directory: $TARGET_DIR"
rm -rf "$TARGET_DIR"/*

# Check if the delete operation was successful
if [ $? -ne 0 ]; then
  echo "Failed to delete files in the target directory. Exiting script."
  exit 1
fi

# Step 3: Copy files from the source directory to the target directory
echo "Copying files from $SOURCE_DIR to $TARGET_DIR"
cp -r "$SOURCE_DIR"/* "$TARGET_DIR"

# Check if the copy operation was successful
if [ $? -ne 0 ]; then
  echo "Failed to copy files to the target directory. Exiting script."
  exit 1
fi

echo "Script completed successfully."