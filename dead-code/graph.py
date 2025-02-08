import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

def plot_grouped_bar_chart(csv_file):
    # Read the CSV file
    df = pd.read_csv(csv_file)
    
    # Rename columns for consistency
    df.rename(columns={'benchmark': 'Name', 'run': 'Category', 'result': 'Total'}, inplace=True)
    
    # Ensure Category is treated as a string
    df['Category'] = df['Category'].astype(str)
    
    # Pivot the table to have 'Baseline' and 'Myopt' as separate columns
    df_pivot = df.pivot(index='Name', columns='Category', values='Total').fillna(0)
    
    # Plotting
    fig, ax = plt.subplots(figsize=(12, 6))
    categories = df_pivot.columns
    x = np.arange(len(df_pivot))  # The label locations
    width = 0.4  # Width of the bars
    
    # Plot bars for each category
    for i, category in enumerate(categories):
        ax.bar(x + (i - 0.5) * width, df_pivot[category], width, label=category)
    
    # Formatting the plot
    ax.set_xlabel('Benchmark')
    ax.set_ylabel('Result')
    ax.set_title('Comparison of pre/post optimization performance by benchmark (LVN Examples Directory)')
    ax.set_xticks(x)
    ax.set_xticklabels(df_pivot.index, rotation=45, ha='right')
    ax.legend()
    
    # Show plot
    plt.tight_layout()
    plt.show()

# Example usage

# Example usage
plot_grouped_bar_chart('results-lvn.csv')
