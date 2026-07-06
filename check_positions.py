import numpy as np

def check_positions():
    sim_data = np.load('data/subhalos_sim.npy')
    temp_data = np.load('data/subhalos_template.npy')
    
    print("sim_data shape:", sim_data.shape)
    print("temp_data shape:", temp_data.shape)
    
    # Let's find the peak pixel for each subhalo in both sim and template
    for i in range(15):
        sim_img = sim_data[i]
        temp_img = temp_data[i]
        
        sim_max_idx = np.unravel_index(np.argmax(sim_img), sim_img.shape)
        temp_max_idx = np.unravel_index(np.argmax(temp_img), temp_img.shape)
        
        sim_max_val = sim_img[sim_max_idx]
        temp_max_val = temp_img[temp_max_idx]
        
        print(f"Subhalo {i:2d}:")
        print(f"  Sim max: {sim_max_val:.4f} at {sim_max_idx}")
        print(f"  Temp max: {temp_max_val:.4f} at {temp_max_idx}")
        print(f"  Diff max: {sim_max_idx[0]-temp_max_idx[0]}, {sim_max_idx[1]-temp_max_idx[1]}")

if __name__ == '__main__':
    check_positions()
