// Tính khoảng cách Euclid giữa 2 vector cùng chiều
const calculateEuclideanDistance = (vecA, vecB) => {
    if (vecA.length !== vecB.length) {
        throw new Error('Hai vector phải có cùng số chiều (dimension)');
    }
    
    // Áp dụng đúng công thức tổng bình phương độ lệch
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        sum += Math.pow(vecA[i] - vecB[i], 2);
    }
    return Math.sqrt(sum);
};

module.exports = { calculateEuclideanDistance };