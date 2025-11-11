import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

// Base Colors contract details
const contractAddress = '0x7bc1c072742d8391817eb4eb2317f98dc72c61db';
const abi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function Home() {
  const [walletAddress, setWalletAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [contract, setContract] = useState(null)
  const [userColors, setUserColors] = useState([])
  const [selectedColor, setSelectedColor] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filteredImage, setFilteredImage] = useState(null)
  const canvasRef = useRef(null)

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setIsLoading(true)
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        const walletProvider = new ethers.BrowserProvider(window.ethereum)
        setProvider(walletProvider)
        
        const signer = await walletProvider.getSigner()
        const address = await signer.getAddress()
        setWalletAddress(address)
        
        // Check if on Base network (chainId: 8453)
        const network = await walletProvider.getNetwork()
        if (network.chainId !== 8453n) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }], // Base chainId in hex
            })
          } catch (switchError) {
            if (switchError.code === 4902) {
              alert('Please add Base network to your wallet')
            }
            throw switchError
          }
        }
        
        const walletContract = new ethers.Contract(contractAddress, abi, signer)
        setContract(walletContract)
        
        // Fetch user's colors
        await fetchUserColors(walletContract, address)
        setIsLoading(false)
      } catch (error) {
        console.error('Wallet connection failed:', error)
        alert('Failed to connect wallet.')
        setIsLoading(false)
      }
    } else {
      alert('Please install MetaMask to use this feature.')
    }
  }

  // Fetch user's Base Colors using Alchemy API
  const fetchUserColors = async (contractInstance, address) => {
    try {
      setIsLoading(true)
      const alchemyApiKey = 'eM_uI9dPBPrkULbHAWc6hMngDH_o769A'
      const url = `https://base-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/getNFTsForOwner?owner=${address}&contractAddresses[]=${contractAddress}&withMetadata=true&pageSize=100`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      })
      
      const data = await response.json()
      const colors = []
      
      if (data.ownedNfts) {
        for (const nft of data.ownedNfts) {
          try {
            const colorHex = nft.name || nft.raw?.metadata?.name
            if (colorHex) {
              colors.push({
                tokenId: nft.tokenId,
                hex: colorHex.startsWith('#') ? colorHex : `#${colorHex}`,
                name: colorHex
              })
            }
          } catch (err) {
            console.error('Error parsing NFT:', err)
          }
        }
      }
      
      setUserColors(colors)
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching colors:', error)
      setIsLoading(false)
    }
  }

  // Apply color filter to default PFP
  const applyColorFilter = (colorHex) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/default_pfp.png'
    
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const context = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      
      // Draw black background
      context.fillStyle = 'black'
      context.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw the image
      context.drawImage(img, 0, 0, img.width, img.height)
      
      // Apply color filter
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Convert hex to RGB
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null
      }
      
      const filterColor = hexToRgb(colorHex)
      const filterThreshold = 50 // Adjust as needed
      
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          
          if (avg > filterThreshold) {
            data[i] = filterColor.r
            data[i + 1] = filterColor.g
            data[i + 2] = filterColor.b
            data[i + 3] = data[i + 3] * (avg / 255)
          }
        }
      }
      
      context.putImageData(imageData, 0, 0)
      setFilteredImage(canvas.toDataURL('image/png'))
    }
  }

  // Handle color selection
  const handleColorSelect = (color) => {
    setSelectedColor(color)
    applyColorFilter(color.hex)
  }

  // Download filtered PFP
  const downloadPFP = () => {
    if (!filteredImage || !selectedColor) return
    
    const link = document.createElement('a')
    link.download = `default-pfp-${selectedColor.hex.replace('#', '')}.png`
    link.href = filteredImage
    link.click()
  }

  return (
    <>
      <Head>
        <title>Default PFPs - Mint Your Base Colors PFP</title>
        <meta name="description" content="Mint your default pfp using your base colors" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`main ${inter.className}`} style={{ 
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: 0,
        position: 'relative'
      }}>
        {/* Header with Connect Wallet */}
        <div style={{
          position: 'sticky',
          top: 0,
          background: '#000',
          borderBottom: '1px solid #222',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Default PFPs</h2>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              disabled={isLoading}
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid #333',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.target.style.background = '#111'
                  e.target.style.borderColor = '#555'
                }
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'transparent'
                e.target.style.borderColor = '#333'
              }}
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div style={{
              background: '#111',
              border: '1px solid #333',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>
            Mint Your Base Colors PFP
          </h1>
          <p style={{ textAlign: 'center', color: '#999', marginBottom: '3rem' }}>
            Select a color from your collection to create your default pfp
          </p>

          {!walletAddress ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <p style={{ color: '#666', fontSize: '1.125rem' }}>Connect your wallet to get started</p>
            </div>
          ) : (
            <div>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p>Loading your Base Colors...</p>
                </div>
              ) : userColors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: '#666' }}>No Base Colors found in your wallet.</p>
                  <p style={{ color: '#666', marginTop: '1rem' }}>
                    <a 
                      href="https://basecolors.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#999', textDecoration: 'underline' }}
                    >
                      Get Base Colors →
                    </a>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  {/* Colors Grid */}
                  <div style={{ flex: '1', minWidth: '300px' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#999' }}>Your Base Colors ({userColors.length})</h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: '#0a0a0a',
                      border: '1px solid #222',
                      borderRadius: '12px',
                      maxHeight: '600px',
                      overflowY: 'auto'
                    }}>
                      {userColors.map((color) => (
                        <div
                          key={color.tokenId}
                          onClick={() => handleColorSelect(color)}
                          style={{
                            aspectRatio: '1',
                            background: color.hex,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: selectedColor?.tokenId === color.tokenId 
                              ? '2px solid #fff' 
                              : '2px solid #222',
                            transition: 'all 0.2s',
                            position: 'relative',
                            boxShadow: selectedColor?.tokenId === color.tokenId 
                              ? '0 0 0 4px rgba(255,255,255,0.1)' 
                              : 'none'
                          }}
                          title={color.hex}
                          onMouseOver={(e) => {
                            if (selectedColor?.tokenId !== color.tokenId) {
                              e.currentTarget.style.borderColor = '#444'
                            }
                          }}
                          onMouseOut={(e) => {
                            if (selectedColor?.tokenId !== color.tokenId) {
                              e.currentTarget.style.borderColor = '#222'
                            }
                          }}
                        >
                          {selectedColor?.tokenId === color.tokenId && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              fontSize: '1.5rem',
                              color: '#fff',
                              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                              fontWeight: 'bold'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div style={{ flex: '1', minWidth: '300px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Preview</h3>
                    <div style={{ 
                      background: '#0a0a0a',
                      border: '1px solid #222',
                      borderRadius: '12px',
                      padding: '2rem',
                      textAlign: 'center'
                    }}>
                      <canvas
                        ref={canvasRef}
                        style={{ 
                          display: 'none'
                        }}
                      />
                      {selectedColor ? (
                        <>
                          <img 
                            src={filteredImage || '/default_pfp.png'}
                            alt="Default PFP"
                            style={{ 
                              maxWidth: '100%',
                              height: 'auto',
                              borderRadius: '12px',
                              marginBottom: '1.5rem',
                              border: '1px solid #222'
                            }}
                          />
                          <p style={{ 
                            color: '#666',
                            marginBottom: '1.5rem',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem'
                          }}>
                            Default PFP {selectedColor.hex}
                          </p>
                          <button
                            onClick={downloadPFP}
                            style={{
                              background: 'transparent',
                              color: '#fff',
                              border: '1px solid #333',
                              padding: '0.75rem 1.5rem',
                              fontSize: '0.875rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              marginBottom: '0.5rem',
                              width: '100%',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#111'
                              e.target.style.borderColor = '#555'
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = 'transparent'
                              e.target.style.borderColor = '#333'
                            }}
                          >
                            Download
                          </button>
                          <button
                            style={{
                              background: 'transparent',
                              color: '#666',
                              border: '1px solid #222',
                              padding: '0.75rem 1.5rem',
                              fontSize: '0.875rem',
                              borderRadius: '6px',
                              cursor: 'not-allowed',
                              opacity: 0.5,
                              width: '100%'
                            }}
                            disabled
                          >
                            Mint (Coming Soon)
                          </button>
                        </>
                      ) : (
                        <div style={{ padding: '3rem' }}>
                          <p style={{ color: '#999' }}>Select a color to preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
