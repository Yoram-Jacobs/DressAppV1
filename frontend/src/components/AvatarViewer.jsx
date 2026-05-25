import React, { useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("AvatarViewer: Failed to load 3D model, using fallback shape.", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function AvatarFallbackMesh({ shapeParams }) {
  const meshRef = useRef();

  // Fallback: simple procedural cylinder scaled by params
  const scaleY = 1 + (shapeParams?.tall || 0) - (shapeParams?.short || 0);
  const scaleX = 1 + (shapeParams?.heavy || 0) - (shapeParams?.thin || 0) + (shapeParams?.waist_thick || 0) * 0.5;
  const scaleZ = 1 + (shapeParams?.heavy || 0) - (shapeParams?.thin || 0) + (shapeParams?.busty || 0) * 0.5;

  return (
    <mesh ref={meshRef} position={[0, scaleY, 0]} scale={[scaleX, scaleY * 2, scaleZ]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
      <meshStandardMaterial color="#c29b7b" />
    </mesh>
  );
}

function AvatarGLTFMesh({ shapeParams, sex }) {
  // Attempt to load the real model based on the user's sex. If this file doesn't exist, it throws and ErrorBoundary catches it.
  const { scene } = useGLTF(`/models/base_avatar_${sex === 'male' ? 'male' : 'female'}.glb?v=2`);
  
  useEffect(() => {
    if (!scene) return;
    
    // Traverse the loaded scene to find meshes with morph targets
    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        // Map our calculated shapeParams to the mesh's blendshapes.
        // This does a generic substring match (e.g. "tall" matches "tall", "Tall", "Key_tall")
        Object.keys(shapeParams).forEach(paramKey => {
          const dictKeys = Object.keys(child.morphTargetDictionary);
          const matchedKey = dictKeys.find(k => k.toLowerCase().includes(paramKey.toLowerCase()));
          
          if (matchedKey !== undefined) {
            const index = child.morphTargetDictionary[matchedKey];
            // Apply the weight (from 0.0 to 1.0)
            child.morphTargetInfluences[index] = shapeParams[paramKey];
          }
        });
      }
    });
  }, [shapeParams, scene]);

  // Adjust position and scale depending on the base model's default size
  return <primitive object={scene} position={[0, 0, 0]} />;
}

export default function AvatarViewer({ shapeParams, sex = 'female' }) {
  return (
    <div className="w-full h-[500px] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <Canvas camera={{ position: [0, 1.5, 4], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        {/* We use an ErrorBoundary around Suspense so a missing .glb falls back to the simple cylinder */}
        <ErrorBoundary fallback={<AvatarFallbackMesh shapeParams={shapeParams || {}} />}>
          <Suspense fallback={<AvatarFallbackMesh shapeParams={shapeParams || {}} />}>
            <AvatarGLTFMesh shapeParams={shapeParams || {}} sex={sex} />
          </Suspense>
        </ErrorBoundary>

        <OrbitControls target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
