import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { Inter } from 'next/font/google'
import { FiCheck } from 'react-icons/fi'

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
  const [filteredImage, setFilteredImage] = useState('/default_pfp.png')
  const [randomColorInput, setRandomColorInput] = useState('#54FF56')
  const canvasRef = useRef(null)

  // Load default pfp on mount
  useEffect(() => {
    setFilteredImage('/default_pfp.png')
  }, [])

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

  // Apply color filter to default pfp
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
    const canvas = canvasRef.current
    if (!canvas) return
    
    const colorHex = selectedColor ? selectedColor.hex : randomColorInput
    
    // Create a temporary canvas for download
    const tempCanvas = document.createElement('canvas')
    const tempContext = tempCanvas.getContext('2d')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height

    // Draw black background
    tempContext.fillStyle = 'black'
    tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

    // Draw the filtered image on top
    tempContext.drawImage(canvas, 0, 0)

    const link = document.createElement('a')
    link.download = `default-pfp-${colorHex.replace('#', '')}.png`
    link.href = tempCanvas.toDataURL('image/png')
    link.click()
  }

  return (
    <>
      <Head>
        <title>default pfps - mint your default pfp</title>
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
          borderBottom: '1px solid #1a1a1a',
          padding: '1rem 1.5rem',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>default pfps</h2>
          <button
            onClick={walletAddress ? null : connectWallet}
            disabled={isLoading}
            style={{
              background: 'transparent',
              color: walletAddress ? '#999' : '#fff',
              border: '1px solid #333',
              padding: '0.5rem 0.875rem',
              fontSize: '0.75rem',
              borderRadius: '6px',
              cursor: walletAddress ? 'default' : (isLoading ? 'not-allowed' : 'pointer'),
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.2s',
              fontFamily: walletAddress ? 'monospace' : 'inherit'
            }}
            onMouseOver={(e) => {
              if (!isLoading && !walletAddress) {
                e.target.style.background = '#111'
                e.target.style.borderColor = '#555'
              }
            }}
            onMouseOut={(e) => {
              if (!walletAddress) {
                e.target.style.background = 'transparent'
                e.target.style.borderColor = '#333'
              }
            }}
          >
            {walletAddress 
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : (isLoading ? 'Connecting...' : 'Connect Wallet')
            }
          </button>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              mint your default pfp
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
              select a color your base color. mint your default pfp.
            </p>
          </div>

          {!walletAddress ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Preview */}
              <div>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#999', fontWeight: 500 }}>Preview</h3>
                <canvas
                  ref={canvasRef}
                  style={{ display: 'none' }}
                />
                <img 
                  src={filteredImage}
                  alt="default pfp"
                  style={{ 
                    maxWidth: '100%',
                    width: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid #1a1a1a'
                  }}
                />
                <p style={{ 
                  color: '#666',
                  marginBottom: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  default pfp {randomColorInput}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                  <button
                    onClick={downloadPFP}
                    style={{
                      background: 'transparent',
                      color: '#fff',
                      border: '1px solid #333',
                      padding: '0.625rem 1rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      width: 'auto'
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
                      padding: '0.625rem 1rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      opacity: 0.5,
                      width: 'auto'
                    }}
                    disabled
                  >
                    Mint (Soon)
                  </button>
                </div>
              </div>

              {/* Random Color Picker */}
              <div>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#999', fontWeight: 500 }}>Try a Color</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={randomColorInput}
                    onChange={(e) => {
                      setRandomColorInput(e.target.value)
                      applyColorFilter(e.target.value)
                    }}
                    style={{
                      width: '60px',
                      height: '40px',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <input
                    type="text"
                    value={randomColorInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setRandomColorInput(value)
                      if (/^#[0-9A-F]{6}$/i.test(value)) {
                        applyColorFilter(value)
                      }
                    }}
                    placeholder="#54FF56"
                    style={{
                      flex: 1,
                      background: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '6px',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.75rem',
                      color: '#fff',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
                  Connect your wallet to mint with your Base Colors
                </p>
              </div>
            </div>
          ) : (
            <div>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>Loading your Base Colors...</p>
                </div>
              ) : userColors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: '#666', fontSize: '0.875rem' }}>No Base Colors found in your wallet.</p>
                  <p style={{ color: '#666', marginTop: '1rem', fontSize: '0.875rem' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Preview - Show first */}
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#999', fontWeight: 500 }}>preview</h3>
                    <canvas
                      ref={canvasRef}
                      style={{ display: 'none' }}
                    />
                    <img 
                      src={filteredImage || '/default_pfp.png'}
                      alt="default pfp"
                      style={{ 
                        maxWidth: '100%',
                        width: '100%',
                        height: 'auto',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        border: '1px solid #1a1a1a'
                      }}
                    />
                    {selectedColor && (
                      <p style={{ 
                        color: '#666',
                        marginBottom: '1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        textAlign: 'center'
                      }}>
                        default pfp {selectedColor.hex}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={downloadPFP}
                        disabled={!selectedColor}
                        style={{
                          background: 'transparent',
                          color: selectedColor ? '#fff' : '#666',
                          border: '1px solid #333',
                          padding: '0.625rem 1rem',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          cursor: selectedColor ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          opacity: selectedColor ? 1 : 0.5,
                          width: 'auto'
                        }}
                        onMouseOver={(e) => {
                          if (selectedColor) {
                            e.target.style.background = '#111'
                            e.target.style.borderColor = '#555'
                          }
                        }}
                        onMouseOut={(e) => {
                          if (selectedColor) {
                            e.target.style.background = 'transparent'
                            e.target.style.borderColor = '#333'
                          }
                        }}
                      >
                        Download
                      </button>
                      <button
                        style={{
                          background: 'transparent',
                          color: '#666',
                          border: '1px solid #222',
                          padding: '0.625rem 1rem',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          cursor: 'not-allowed',
                          opacity: 0.5,
                          width: 'auto'
                        }}
                        disabled
                      >
                        Mint (Soon)
                      </button>
                    </div>
                  </div>

                  {/* Colors Grid */}
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#999', fontWeight: 500 }}>Your Base Colors ({userColors.length})</h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                      gap: '0.5rem',
                      padding: '1rem',
                      background: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '8px',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {userColors.map((color) => (
                        <div
                          key={color.tokenId}
                          onClick={() => handleColorSelect(color)}
                          style={{
                            aspectRatio: '1',
                            background: color.hex,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            position: 'relative',
                            boxShadow: selectedColor?.tokenId === color.tokenId 
                              ? '0 0 0 3px rgba(255,255,255,0.1)' 
                              : 'none'
                          }}
                          title={color.hex}
                          onMouseOver={(e) => {
                            if (selectedColor?.tokenId !== color.tokenId) {
                              e.currentTarget.style.borderColor = '#333'
                              e.currentTarget.style.transform = 'scale(1.05)'
                            }
                          }}
                          onMouseOut={(e) => {
                            if (selectedColor?.tokenId !== color.tokenId) {
                              e.currentTarget.style.borderColor = '#1a1a1a'
                              e.currentTarget.style.transform = 'scale(1)'
                            }
                          }}
                        >
                          {selectedColor?.tokenId === color.tokenId && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <FiCheck 
                                size={20}
                                color="rgba(0, 0, 0, 0.5)"
                                style={{ 
                                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                                  strokeWidth: 3
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
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
